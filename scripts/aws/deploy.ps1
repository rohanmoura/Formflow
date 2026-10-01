param(
  [string]$Region = (aws configure get region),
  [ValidateSet("t3.small", "t3.medium")]
  [string]$InstanceType = "t3.small",
  [string]$GitRef = "master",
  [string]$DockerHubImage = "rohanmoura/formflow:latest"
)

$ErrorActionPreference = "Stop"
if (-not $Region) { throw "Configure AWS CLI first with 'aws configure' or pass -Region." }
if ($GitRef -notmatch '^[A-Za-z0-9._/-]+$') { throw "GitRef contains unsupported characters." }
if ($DockerHubImage -notmatch '^[A-Za-z0-9._/-]+:[A-Za-z0-9._-]+$') { throw "DockerHubImage must use the form repository:tag." }

$identity = aws sts get-caller-identity --region $Region --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "AWS CLI credentials are unavailable." }
$account = $identity.Account
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$repository = "https://github.com/rohanmoura/Formflow.git"
$userData = (Get-Content (Join-Path $repoRoot "infra\aws\user-data.sh") -Raw).Replace("__REPOSITORY__", $repository).Replace("__GIT_REF__", $GitRef).Replace("__IMAGE__", $DockerHubImage)
$userDataPath = Join-Path $env:TEMP "formflow-user-data-$([guid]::NewGuid().ToString('N')).sh"
$trustPath = Join-Path $env:TEMP "formflow-trust-$([guid]::NewGuid().ToString('N')).json"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($userDataPath, $userData, $utf8NoBom)

try {
  $imageId = (aws ssm get-parameter --region $Region --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 --query Parameter.Value --output text).Trim()
  if ($LASTEXITCODE -ne 0) { throw "Could not resolve the latest Amazon Linux AMI." }
  $profileName = "formflow-ec2-$account"
  $roleName = "formflow-ec2-$account"
  @{
    Version = "2012-10-17"
    Statement = @(@{ Effect = "Allow"; Principal = @{ Service = "ec2.amazonaws.com" }; Action = "sts:AssumeRole" })
  } | ConvertTo-Json -Depth 5 | ForEach-Object { [System.IO.File]::WriteAllText($trustPath, $_, $utf8NoBom) }

  $role = aws iam get-role --role-name $roleName --output json 2>$null | ConvertFrom-Json
  if (-not $role) {
    aws iam create-role --role-name $roleName --assume-role-policy-document "file://$trustPath" --description "SSM access for FormFlow EC2" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not create the EC2 instance role." }
  }
  aws iam attach-role-policy --role-name $roleName --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not attach the SSM policy." }

  $profile = aws iam get-instance-profile --instance-profile-name $profileName --output json 2>$null | ConvertFrom-Json
  if (-not $profile) {
    aws iam create-instance-profile --instance-profile-name $profileName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not create the EC2 instance profile." }
    aws iam add-role-to-instance-profile --instance-profile-name $profileName --role-name $roleName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not attach the role to its instance profile." }
    Start-Sleep -Seconds 12
  }

  $defaultVpc = aws ec2 describe-vpcs --region $Region --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text
  if ($LASTEXITCODE -ne 0 -or -not $defaultVpc -or $defaultVpc -eq "None") { throw "This region has no default VPC. Create one in AWS, then try again." }
  $securityGroup = aws ec2 create-security-group --region $Region --vpc-id $defaultVpc --group-name "formflow-web-$([guid]::NewGuid().ToString('N').Substring(0,8))" --description "Public HTTPS for FormFlow" --query GroupId --output text
  if ($LASTEXITCODE -ne 0) { throw "Could not create a security group." }
  aws ec2 authorize-security-group-ingress --region $Region --group-id $securityGroup --ip-permissions '[{"IpProtocol":"tcp","FromPort":80,"ToPort":80,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]},{"IpProtocol":"tcp","FromPort":443,"ToPort":443,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]}]' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not authorize public web traffic." }

  $instanceId = aws ec2 run-instances --region $Region --image-id $imageId --instance-type $InstanceType --iam-instance-profile "Name=$profileName" --security-group-ids $securityGroup --user-data "file://$userDataPath" --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":24,"VolumeType":"gp3","DeleteOnTermination":true}}]' --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=FormFlow}]' --query "Instances[0].InstanceId" --output text
  if ($LASTEXITCODE -ne 0) { throw "EC2 launch failed." }
  aws ec2 wait instance-running --region $Region --instance-ids $instanceId
  if ($LASTEXITCODE -ne 0) { throw "EC2 did not reach running state." }
  $address = aws ec2 describe-instances --region $Region --instance-ids $instanceId --query "Reservations[0].Instances[0].PublicIpAddress" --output text

  Write-Host "Instance launched: $instanceId"
  Write-Host "Public URL: https://$address"
  Write-Host "Waiting for FormFlow and HTTPS to start..."
  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    try {
      $response = Invoke-WebRequest "https://$address/api/health" -TimeoutSec 5
      if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 15
  }
  Write-Host "Connect with AWS Systems Manager: aws ssm start-session --region $Region --target $instanceId"
  Write-Host "Bootstrap log: sudo tail -f /var/log/formflow-bootstrap.log"
  Write-Host "After the demo, remove the instance and its database with scripts/aws/terminate.ps1 -InstanceId $instanceId -Region $Region."
  if ($ready) {
    Write-Host "FormFlow is live: https://$address"
  } else {
    throw "Instance $instanceId launched, but FormFlow did not become healthy within 10 minutes. It remains running for diagnosis; check the bootstrap log and terminate it when finished."
  }
} finally {
  Remove-Item -LiteralPath $userDataPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $trustPath -Force -ErrorAction SilentlyContinue
}
