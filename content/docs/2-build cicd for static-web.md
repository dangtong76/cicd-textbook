---
title: "3. 정적 웹사이트 파이프라인 구성"
weight: 3
date: 2025-02-02
draft: false
---
---
## 구축을 위한 디자인 컨셉
  {{< embed-pdf url="/cicd-textbook/pdfs/what_container.pdf" >}}
  {{< embed-pdf url="/cicd-textbook/pdfs/codedeploy.pdf" >}}

---
## 1. Simple Web 무식하게 배포하기
---

Simple Web 은 정적 웹 페이지로 구성된 프로젝트입니다. 이번장에서는 가장 단순한 현태의 애플리케이션을 AWS 에 배포하는 파이프라인을 구성합니다.

파이프라인 구성시에 사용되는 **기술 스택**은 아래와 같습니다.

- Terraform
- GitHub Actions
- AWS S3
- AWS CodeDeploy

### 1. 프로젝트 포크 하기

1. GitHub 에서 프로젝트 포크
   
   GitHub [simple-web](https://github.com/dangtong76/simple-web) 에서 프로젝트 포크 → 포크 버튼 클릭 → 포크 이름 입력 → 포크 생성

2. gh 명령어를 이용한 포크
   
   ```bash
   gh auth status
   
   gh auth switch # 필요 하다면 수행 
   
   gh repo fork https://github.com/dangtong76/simple-web.git

   Would you like to clone the fork? Yes # 클론까지 한번에

   # git clone  https://github.com/<your-github-id>/simple-web.git simple-web
   ```


3. 워크플로우 디렉토리 생성
   
   ```bash
   mkdir -p .github/workflows
   mkdir -p xinfra/aws-ec2-single
   ```

5. Git 브랜치 표시 설정
  
    vi ~/.bashrc 
   ```bash
   # .bashrc 파일에 추가
   parse_git_branch() {
     git branch 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/ (\1)/'
   }
   
   # Git 브랜치를 컬러로 표시
   export PS1="\u@\h \[\033[32m\]\w\[\033[33m\]\$(parse_git_branch)\[\033[00m\] $ "

   ```
    설정 적용하기
   ```bash
   source ~/.bashrc
   ```

### 2. AWS 자격증명 생성 및 입력

1. 사용자 그룹 생성
   
   AWS 콘솔 → 그룹생성 → 그룹 이름 ("cicd") → 권한 정책 연결 ("Administrator Access" 선택) → 사용자 그룹 생성

2. 사용자 생성
   
   AWS 콘솔 → 사용자 → 사용자 생성 → 사용자 이름 ("cicd") → 다음 → 그룹에 사용자 추가 ("cicd 그룹 선택") → 사용자 생성

3. 자격증명 생성
   
   AWS 콘솔 → 사용자 →  cicd → 보안 자격 증명 (탭) → **엑세스 키** 항목 → 엑세스 키 만들기 → Command Line Interface(CLI)  선택 → 다음 → 엑세스 키 만들기 

4. 자격증명 설정
   
   ```bash
   aws configure
   
   # AWS Access Key ID [None]: AKIARHXXXXXXXXXXXXXXXXXXXXXXXX
   # AWS Secret Access Key [None]: awnmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   # Default region name [None]: ap-northeast-2
   # Default output format [None]: yaml
   ```
   
   ### 3. Terraform 코드 생성

5. 코드 작성 (xinfra/aws-ec2-single/main.tf)
   
   ```terraform
   provider "aws" {
     region = "ap-northeast-2" # 사용할 AWS 리전
   }
   
   # 보안 그룹 설정: SSH(22) 및 HTTP(80) 트래픽 허용
   resource "aws_security_group" "nginx_sg" {
     name_prefix = "nginx-sg"
   
     ingress {
       description = "Allow SSH"
       from_port   = 22
       to_port     = 22
       protocol    = "tcp"
       cidr_blocks = ["0.0.0.0/0"]
     }
   
     ingress {
       description = "Allow HTTP"
       from_port   = 80
       to_port     = 80
       protocol    = "tcp"
       cidr_blocks = ["0.0.0.0/0"]
     }
   
     egress {
       from_port   = 0
       to_port     = 0
       protocol    = "-1"
       cidr_blocks = ["0.0.0.0/0"]
     }
   }
   
   # TLS 프라이빗 키 생성 (공개 키 포함)
   resource "tls_private_key" "example" {
     algorithm = "RSA"
     rsa_bits  = 2048
   }
   
   # AWS에서 키 페어 생성
   resource "aws_key_pair" "ec2_key" {
     key_name   = "ec2-key" # AWS에서 사용할 키 페어 이름
     public_key = tls_private_key.example.public_key_openssh
   }

    # EC2 인스턴스 생성
    resource "aws_instance" "nginx_instance" {
      ami             = "ami-08b09b6acd8d62254" # Amazon Linux 2 AMI (리전별로 AMI ID가 다를 수 있음)
      instance_type   = "t2.micro"
      key_name        = aws_key_pair.ec2_key.key_name # AWS에서 생성한 SSH 키 적용
      security_groups = [aws_security_group.nginx_sg.name]
    
      # EC2 시작 시 Nginx 설치 및 실행을 위한 User Data
      user_data = <<-EOF
                  #!/bin/bash
                  yum update -y
                  amazon-linux-extras install nginx1 -y
                  systemctl start nginx
                  systemctl enable nginx
                  EOF
      tags = {
        Name = "nginx-server"
      }
    }
    
    
    # 출력: EC2 인스턴스의 퍼블릭 IP 주소
    output "nginx_instance_public_ip" {
      value       = aws_instance.nginx_instance.public_ip
      description = "Public IP of the Nginx EC2 instance"
    }
    
    # 출력: SSH 접속에 사용할 Private Key
    output "ssh_private_key_pem" {
      value       = tls_private_key.example.private_key_pem
      description = "Private key for SSH access"
      sensitive   = true
    }
    ```

2. 실행
   
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```
3. .gitignore 파일 생성

   ```bash
   .terraform
   .terraform.lock.hcl
   terraform.tfstate
   .DS_Store
   terraform.tfstate.backup
   ```
4. 리포지토리 동기화 
   ```bash
   git add .
   git commit -am "add terraform code"
   git push origin start
   ```

### 4. Github Secret 만들기

- Secret 목록
  
  - IAM User Credential 에 서 생성
    
    - AWS_ACCESS_KEY_ID
    - AWS_SECRET_ACCESS_KEY
  
  - AWS_HOST (EC2 console 에서 복사)
  
  - AWS_KEY (terraform 명령으로 output 출력)
    
    ```yaml
    # 출력결과 복사해서 입력
    terraform output ssh_private_key_pem
    ```
  
  - AWS_USER : ec2-user (EC2 인스턴스의 OS 계정)

### 5. Github Actions 워크플로우 생성

2. 파일명 : .github/workflows/simple-web-ec2-workflow.yaml 작성
      ```yaml
      name: Deploy Simple-Web to AWS EC2 using AWS CLI
      on:
        push:
          branches:
            - main
      jobs:
        deploys:
          runs-on: ubuntu-latest
          steps:
            - name: 1.소스코드 가져오기
              uses: actions/checkout@v3
            - name: 2.AWS 접속정보 설정
              uses: aws-actions/configure-aws-credentials@v3
              with:
                aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
                aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
                aws-region: ap-northeast-2
            - name: 2.SSH키 설정
              uses: webfactory/ssh-agent@v0.5.3
              with:
                ssh-private-key: ${{ secrets.AWS_KEY}}
            - name: 3.파일 목록보기
              run: |
                ssh -o StrictHostKeyChecking=no ${{ secrets.AWS_USER }}@${{ secrets.AWS_HOST }}  "ls -al /home/${{ secrets.AWS_USER }}"
            - name: 4.파일 서버로 복사
              run: |
                ssh -o StrictHostKeyChecking=no ${{ secrets.AWS_USER }}@${{ secrets.AWS_HOST }}  "sudo chown -R ec2-user:ec2-user /usr/share/nginx/html"
                scp -o StrictHostKeyChecking=no -r ./* ${{ secrets.AWS_USER }}@${{ secrets.AWS_HOST }}:/usr/share/nginx/html
            - name: Restart Web Server
              run: |
                ssh -o StrictHostKeyChecking=no ${{ secrets.AWS_USER }}@${{ secrets.AWS_HOST }} "sudo systemctl restart nginx || sudo systemctl restart httpd"
      ```
3. 리포지토리 동기화
  
   ```bash
   git add .
   git commit -am "add github actions workflow"
   git push origin start
   ```

4. 워크플로우 실행 결과 확인

   - http://<EC2 인스턴스의 퍼블릭 IP 주소> 에 접속하여 웹 페이지 확인
    
    

---
## 2. Simple Web 현명하게 배포하기
### 1. EC2용 IAM 역할 생성하기

1. EC2용 IAM 역할 생성하기
   AWS 콘솔에서 : IAM → 역할 → 역할생성
  {{< figure src="/cicd-textbook/images/1-iam.png" alt="IAM 이미지" class="img-fluid" width="80%">}}

2. 역할 생성 화면에서 아래와 같이 [ AWS 서비스 | 서비스 또는 사용사례 = EC2 |  사용사례 = EC2 ]  선택 → 다음
  {{< figure src="/cicd-textbook/images/2-iam.png" alt="IAM 이미지" class="img-fluid" width="80%">}}

3. AWSCodeDeployFullAccess  및 AmazonS3FullAccess 정책 추가 → 다음
  {{< figure src="/cicd-textbook/images/3-iam.png" alt="IAM 이미지" class="img-fluid" width="80%">}}

4. 역할이름 : simple-web-ec2-deploy-role → 다음
  {{< figure src="/cicd-textbook/images/4-iam.png" alt="IAM 이미지" class="img-fluid" width="80%">}}

### 2. CodeDeploy용 IAM 역할 생성

2. AWS 콘솔에서 : IAM → 역할 → 역할생성
  역할생성 화면에서 : [AWS 서비스 | 서비스 또는 사용사례 = CodeDeploy  | 사용사례 = CodeDeploy ] 
  {{< figure src="/cicd-textbook/images/5-iam.png" alt="IAM 이미지" class="img-fluid" width="80%">}}

2. 내용 확인하고 → 다음
  {{< figure src="/cicd-textbook/images/6-iam.png" alt="IAM 이미지" class="img-fluid" width="80%">}}

2. 역할 이름 : simple-web-codedeploy-role 입력 → 역할생성 버튼 클릭
  {{< figure src="/cicd-textbook/images/7-iam.png" alt="IAM 이미지" class="img-fluid" width="80%">}}

### 3. Terrafrom 코드로 EC2 인스턴스 생성 하기
1. Terraform 코드 작성 (main.tf)
    ```terraform
    provider "aws" {
      region = "ap-northeast-2" # 사용할 AWS 리전
    }

    # 보안 그룹 설정: SSH(22) 및 HTTP(80) 트래픽 허용
    resource "aws_security_group" "nginx_sg" {
      name_prefix = "nginx-sg-"

      ingress {
        description = "Allow SSH"
        from_port   = 22
        to_port     = 22
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
      }

      ingress {
        description = "Allow HTTP"
        from_port   = 80
        to_port     = 80
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
      }

      egress {
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
      }
    }

    # TLS 프라이빗 키 생성 (공개 키 포함)
    resource "tls_private_key" "example" {
      algorithm = "RSA"
      rsa_bits  = 2048
    }

    # AWS에서 키 페어 생성
    resource "aws_key_pair" "ec2_key" {
      key_name   = "ec2-key" # AWS에서 사용할 키 페어 이름
      public_key = tls_private_key.example.public_key_openssh
    }

    # EC2 인스턴스 생성
    resource "aws_instance" "nginx_instance" {
      ami             = "ami-08b09b6acd8d62254" # Amazon Linux 2 AMI (리전별로 AMI ID가 다를 수 있음)
      instance_type   = "t2.micro"
      key_name        = aws_key_pair.ec2_key.key_name # AWS에서 생성한 SSH 키 적용
      security_groups = [aws_security_group.nginx_sg.name]

      # EC2 시작 시 Nginx 설치 및 실행을 위한 User Data
      user_data = <<-EOF
                    #!/bin/bash
                    yum update -y

                    # Ruby 설치
                    yum install -y ruby wget

                    # CodeDeploy Agent 설치
                    cd /home/ec2-user
                    wget https://aws-codedeploy-ap-northeast-2.s3.ap-northeast-2.amazonaws.com/latest/install
                    chmod +x ./install
                    ./install auto

                    # CodeDeploy Agent 서비스 시작
                    systemctl start codedeploy-agent
                    systemctl enable codedeploy-agent

                    # nginx 설치
                    amazon-linux-extras install nginx1 -y
                    systemctl start nginx
                    systemctl enable nginx
                    EOF
                    
      tags = {
        Name        = "nginx-server"
        Environment = "Production"
      }
    }

    # 출력: EC2 인스턴스의 퍼블릭 IP 주소
    output "nginx_instance_public_ip" {
      value       = aws_instance.nginx_instance.public_ip
      description = "Public IP of the Nginx EC2 instance"
    }

    # 출력: SSH 접속에 사용할 Private Key
    output "ssh_private_key_pem" {
      value       = tls_private_key.example.private_key_pem
      description = "Private key for SSH access"
      sensitive   = true
    }
    ```

### 4. EC2 인스턴스에서 역할 연결하기

EC2 → 인스턴스  → 인스턴스 ID  → 작업  → 보안  → IAM 역할수정  → IAM 역할 선택 → simple-web-ec2-deploy-role 선택  → IAM 역할 업데이트

  {{< figure src="/cicd-textbook/images/8-iam.png" alt="IAM 이미지" class="img-fluid" width="80%" >}}

### 5. S3 버킷 만들기
  S3 화면에서  → 버킷 만들기 클릭
  버킷이름 : simple-web-content 
  나머지는 모두 Default 로 생성

  {{< figure src="/cicd-textbook/images/9-s3.png" alt="S3 이미지" class="img-fluid" width="80%">}}

### 6. CodeDeploy 애플리케이션 만들기
  codedeploy  → 애플리케이션  → 애플리케이션 생성
  애플리케이션 이름 : simple-web-content 
  {{< figure src="/cicd-textbook/images/10-codedeploy.png" alt="CodeDeploy 이미지" class="img-fluid" width="80%">}}

### 7. CodeDeploy 배포 그룹 만들기
1. 배포 그룹 생성

  codedeploy  → 애플리케이션   → 배포 그룹 생성

  배포그룹이름입력 : simple-web-deploy-group

  서비스역할 : simple-web-codedeploy-role 

  {{< figure src="/cicd-textbook/images/11-codedeploy-group.png" alt="CodeDeploy 이미지" class="img-fluid" width="80%">}}
  
2. 계속

  애플리케이션 배포 방법 : 현재 위치

  환경구성 : Amazon EC2 인스턴스

  태그 그룹 : 키 = Environment | 값 = Production

  **로드 밸런서 체크 박스 비활성화**

  {{< figure src="/cicd-textbook/images/12-codedeploy-group.png" alt="CodeDeploy 이미지" class="img-fluid" width="80%">}}



### 8. Github Action Secret 업데이트
아래 SECRET 업데이트 해주기

AWS_HOST

AWS_BUCKET
  
### 9. Github Action Workflow 작성하기
1. workflow 파일 작성

    ```yml
    ## ec2 s3 deploy12
    name: Deploy to AWS
    on:
      push:
        branches: [main]

    jobs:
      deploy:
        runs-on: ubuntu-latest
        steps:
          - name: 1.소스코드 다운로드 (simple-web)
            uses: actions/checkout@v2

          - name: 2.AWS CLI 접속정보 설정
            uses: aws-actions/configure-aws-credentials@v4
            with:
              aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
              aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
              aws-region: ap-northeast-2

          - name: 3.아티팩트 만들기
            run: |
              pwd
              zip -r deploy.zip ./*

          - name: 4.S3 아티팩트 업로드
            run: |
              aws s3 cp deploy.zip s3://${{ secrets.S3_BUCKET }}/deploy.zip

          - name: 5.현재 진행중인 AWS Deploy ID 가져오고 중단 시킨다. 
            run: |
              DEPLOYMENTS=$(aws deploy list-deployments \
                --application-name simple-web-content \
                --deployment-group-name simple-web-deploy-group \
                --include-only-statuses "InProgress" \
                --query 'deployments[]' \
                --output text)
              
              if [ ! -z "$DEPLOYMENTS" ]; then
                for deployment in $DEPLOYMENTS; do
                  echo "Stopping deployment $deployment"
                  aws deploy stop-deployment --deployment-id $deployment
                done
                # 잠시 대기하여 취소가 완료되도록 함
                sleep 10
              fi

          - name: 6. AWS Deploy를 통해 배포한다
            id: deploy
            run: |
              DEPLOYMENT_ID=$(aws deploy create-deployment \
                --application-name simple-web-content \
                --deployment-group-name simple-web-deploy-group \
                --s3-location bucket=${{ secrets.S3_BUCKET }},key=deploy.zip,bundleType=zip \
                --output text \
                --query 'deploymentId')
              #echo "::set-output name=deployment_id::$DEPLOYMENT_ID"
              #echo "{name}=deployment_id" >> $GITHUB_OUTPUT
              echo "deployment_id=${DEPLOYMENT_ID}" >> $GITHUB_OUTPUT

          - name: Wait for deployment to complete
            run: |
              aws deploy wait deployment-successful --deployment-id ${{ steps.deploy.outputs.deployment_id }}

    ```
2. 스크립트 등록
    
    scripts/before_install.sh
    ```bash
    #!/bin/bash
    if [ -d /usr/share/nginx/html ]; then
        rm -rf /usr/share/nginx/html/*
    fi
    ```
    scripts/after_install.sh
    ```bash
    #!/bin/bash
    chmod -R 755 /usr/share/nginx/html
    chown -R nginx:nginx /usr/share/nginx/html
    systemctl restart nginx
    ```
3. appspec.yml 등록하기
    ```
    version: 0.0
    os: linux
    files:
      - source: /
        destination: /usr/share/nginx/html/
        overwrite: true
    permissions:
      - object: /usr/share/nginx/html
        pattern: "**"
        owner: nginx
        group: nginx
        mode: 755
        type:
          - directory
      - object: /usr/share/nginx/html
        pattern: "**/*"
        owner: nginx
        group: nginx
        mode: 644
        type:
          - file
    hooks:
      BeforeInstall:
        - location: scripts/before_install.sh
          timeout: 300
          runas: root
      AfterInstall:
        - location: scripts/after_install.sh
          timeout: 300
          runas: root
    ```
3. 리포지토리 동기화 하기

    ```bash
    git add .
    git commit -am "add github actions workflow"
    git push origin start
    ```

4. AWS EC2 인스턴스에서 Agent 배포 로그 확인하기

    ```bash
    sudo tail -f /var/log/aws/codedeploy-agent/codedeploy-agent.log
    ```
---
## 3. Simple Web 완벽하게 배포 하기
### 1. 폴더 생성
```bash
mkdir -p xinfra/aws-ec2-single-greate
```
### 2. Gitignore 작성 
파일명 : xinfra/aws-ec2-single-greate/.gitignore 파일 작성
```gitignore
.terraform
.terraform.lock.hcl
terraform.tfstate
.DS_Store
terraform.tfstate.backup
```
### 3. 프로바이더 작성 
파일명 : xinfra/aws-ec2-single-greate/00_provider.tf 작성
```terraform
provider "aws" {
region = "ap-northeast-2" # 사용할 AWS 리전
} 
```
### 4. VPC 생성
파일명 : xinfra/aws-ec2-single-greate/10_vpc.tf 작성
```terraform
# VPC 생성
resource "aws_vpc" "dangtong-vpc" {
  cidr_block           = "10.0.0.0/16" 
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "dangtong-vpc"
  }
}
# 퍼블릭 서브넷 생성
resource "aws_subnet" "dangtong-vpc-public-subnet" {
  for_each = {
    a = { cidr = "10.0.1.0/24", az = "ap-northeast-2a" }
    b = { cidr = "10.0.2.0/24", az = "ap-northeast-2b" }
    c = { cidr = "10.0.3.0/24", az = "ap-northeast-2c" }
    d = { cidr = "10.0.4.0/24", az = "ap-northeast-2d" }
  }

  vpc_id                  = aws_vpc.dangtong-vpc.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = true

  tags = {
    Name = "dangtong-vpc-public-subnet-${each.key}"
  }
}

# 인터넷 게이트웨이 생성
resource "aws_internet_gateway" "dangtong-igw" {
  vpc_id = aws_vpc.dangtong-vpc.id

  tags = {
    Name = "dangtong-igw"
  }
}

# 라우팅 테이블 생성
resource "aws_route_table" "dangtong-vpc-public-rt" {
  vpc_id = aws_vpc.dangtong-vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.dangtong-igw.id
  }

  tags = {
    Name = "dangtong-vpc-public-rt"
    
  }
}

resource "aws_route_table_association" "dangtong-vpc-public-rt" {
  for_each = {
    a = aws_subnet.dangtong-vpc-public-subnet["a"].id
    b = aws_subnet.dangtong-vpc-public-subnet["b"].id
    c = aws_subnet.dangtong-vpc-public-subnet["c"].id
    d = aws_subnet.dangtong-vpc-public-subnet["d"].id
  }
  
  subnet_id      = each.value
  route_table_id = aws_route_table.dangtong-vpc-public-rt.id
}

```
### 5. Security Group 생성
파일명 : xinfra/aws-ec2-single-greate/20_provider.tf 작성
```terraform
resource "aws_security_group" "nginx_sg" {
  name_prefix = "nginx-sg"
  vpc_id      = aws_vpc.dangtong-vpc.id 

  ingress {
    description = "Allow SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```
### 6. EC2 인스턴스 생성
파일명 : xinfra/aws-ec2-single-greate/30_ec2.tf 작성
```terraform
# TLS 프라이빗 키 생성 (공개 키 포함)
resource "tls_private_key" "ec2_private_key" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

# AWS에서 키 페어 생성
resource "aws_key_pair" "ec2_key_pair" {
  key_name   = "ec2-key_pair" # AWS에서 사용할 키 페어 이름
  public_key = tls_private_key.ec2_private_key.public_key_openssh
}

resource "aws_instance" "nginx_instance" {
  subnet_id = aws_subnet.dangtong-vpc-public-subnet["a"].id
  ami             = "ami-08b09b6acd8d62254" # Amazon Linux 2 AMI (리전별로 AMI ID가 다를 수 있음)
  instance_type   = "t2.micro"
  key_name        = aws_key_pair.ec2_key_pair.key_name # AWS에서 생성한 SSH 키 적용
  vpc_security_group_ids = [aws_security_group.nginx_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name

  # EC2 시작 시 Nginx 설치 및 실행을 위한 User Data
  user_data = <<-EOF
                #!/bin/bash
                yum update -y

                # Ruby 설치
                yum install -y ruby wget

                # CodeDeploy Agent 설치
                cd /home/ec2-user
                wget https://aws-codedeploy-ap-northeast-2.s3.ap-northeast-2.amazonaws.com/latest/install
                chmod +x ./install
                ./install auto

                # CodeDeploy Agent 서비스 시작
                systemctl start codedeploy-agent
                systemctl enable codedeploy-agent

                # nginx 설치
                amazon-linux-extras install nginx1 -y
                systemctl start nginx
                systemctl enable nginx
                EOF
  tags = {
    Name        = "nginx-server"
    Environment = "Production"
  }
}

# 출력: EC2 인스턴스의 퍼블릭 IP 주소
output "nginx_instance_public_ip" {
  value       = aws_instance.nginx_instance.public_ip
  description = "Public IP of the Nginx EC2 instance"
}

# 출력: SSH 접속에 사용할 Private Key
output "ssh_private_key_pem" {
  value       = tls_private_key.ec2_private_key.private_key_pem
  description = "Private key for SSH access"
  sensitive   = true
}
```
### 7. IAM  생성
파일명 : xinfra/aws-ec2-single-greate/40_iam.tf 작성
```terraform
# GitHub Actions용 IAM 역할 생성
resource "aws_iam_role" "github_actions_role" {
  name = "GithubActionsRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
      }
    ]
  })

  tags = {
    Name = "github-actions-role"
  }
}

# CodeDeploy를 위한 EC2 IAM 역할
resource "aws_iam_role" "ec2_codedeploy_role" {
  name = "EC2CodeDeployRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "ec2-codedeploy-role"
  }
}

# CodeDeploy 서비스 역할
resource "aws_iam_role" "codedeploy_service_role" {
  name = "CodeDeployServiceRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codedeploy.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "codedeploy-service-role"
  }
}

# GitHub Actions 역할에 정책 연결
resource "aws_iam_role_policy_attachment" "github_actions_s3" {
  role       = aws_iam_role.github_actions_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_role_policy_attachment" "github_actions_codedeploy" {
  role       = aws_iam_role.github_actions_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployFullAccess"
}

# EC2 인스턴스 역할에 정책 연결
resource "aws_iam_role_policy_attachment" "ec2_codedeploy_s3" {
  role       = aws_iam_role.ec2_codedeploy_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
}

resource "aws_iam_role_policy_attachment" "ec2_codedeploy" {
  role       = aws_iam_role.ec2_codedeploy_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole"
}

# CodeDeploy 서비스 역할에 정책 연결
resource "aws_iam_role_policy_attachment" "codedeploy_service" {
  role       = aws_iam_role.codedeploy_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole"
}

# EC2 인스턴스 프로파일 생성
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "EC2CodeDeployProfile"
  role = aws_iam_role.ec2_codedeploy_role.name
}

# 현재 AWS 계정 ID를 가져오기 위한 데이터 소스
data "aws_caller_identity" "current" {}

# 출력: GitHub Actions 역할 ARN
output "github_actions_role_arn" {
  value       = aws_iam_role.github_actions_role.arn
  description = "ARN of the GitHub Actions IAM Role"
}
```

### 8. S3  생성
파일명 : xinfra/aws-ec2-single-greate/50_s3.tf
```terraform
# S3 버킷 생성
resource "aws_s3_bucket" "deploy_bucket" {
  bucket = "simple-web-deploy-bucket-${data.aws_caller_identity.current.account_id}"  # 고유한 버킷 이름 필요
}

# S3 버킷 버전 관리 설정
resource "aws_s3_bucket_versioning" "deploy_bucket_versioning" {
  bucket = aws_s3_bucket.deploy_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 버킷 이름 출력
output "deploy_bucket_name" {
  value       = aws_s3_bucket.deploy_bucket.id
  description = "Name of the S3 bucket for deployments"
}
```
### 9. codedeploy 생성
파일명 : xinfra/aws-ec2-single-greate/60_codedeploy.tf
```terraform
# CodeDeploy 애플리케이션 생성
resource "aws_codedeploy_app" "web_app" {
  name = "simple-web-content"
}

# CodeDeploy 배포 그룹 생성
resource "aws_codedeploy_deployment_group" "web_deploy_group" {
  app_name               = aws_codedeploy_app.web_app.name
  deployment_group_name  = "simple-web-deploy-group"
  service_role_arn      = aws_iam_role.codedeploy_service_role.arn

  deployment_style {
    deployment_option = "WITHOUT_TRAFFIC_CONTROL"
    deployment_type   = "IN_PLACE"
  }

  ec2_tag_set {
    ec2_tag_filter {
      key   = "Environment"
      type  = "KEY_AND_VALUE"
      value = "Production"
    }
  }

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE"]
  }

  alarm_configuration {
    enabled = false
  }
}

# CodeDeploy 애플리케이션 이름 출력
output "codedeploy_app_name" {
  value       = aws_codedeploy_app.web_app.name
  description = "Name of the CodeDeploy application"
}

# CodeDeploy 배포 그룹 이름 출력
output "codedeploy_deployment_group_name" {
  value       = aws_codedeploy_deployment_group.web_deploy_group.deployment_group_name
  description = "Name of the CodeDeploy deployment group"
} 
```
---

## 연습문제 3-1
ailogy 라는 회사는 판교에서 창업한지 얼마 되지 않는 신생 스타트업 회사 입니다. 
이회사의 CTO인 당신은 회사 홈페이지를 최근 유행하는 Hugo 프레임워크와 테마를 이용해 만들기로 결정 했습니다.
다음 요구사항을 만족하는 회사 홈페이지를 만들고, CI/CD 환경을 구축하세요
1. Hugo 로컬 설정 (Optional)
    - GO설치하기 : [GO 설치](https://go.dev/doc/install)
    - Saas설치 : [dart-sass 설치](https://github.com/sass/dart-sass/releases/tag/1.85.1)
    - hugo cli 설치하고 환경변수 등록하기 : [hugo 설치](https://github.com/gohugoio/hugo/releases/tag/v0.145.0)
1. Hugo 템플릿 적용하기 :  https://github.com/StefMa/hugo-fresh
    ```bash
    # Hugo 사이트 생성
    hugo new site ailogy && cd ailogy

    # Hugo 사이트 모듈 초기화
    hugo mod init github.com/dangtong76/ailogy

    # 기본 설정 파일 삭제 
    rm hugo.toml

    # 설정 파일 다운로드
    curl -O https://raw.githubusercontent.com/StefMa/hugo-fresh/master/exampleSite/hugo.yaml

    # 로컬 머신 실행 (Windows)
    hugo server -D

    # 컨테이너 IDE 실행 (ubuntu container)
    hugo server --bind 0.0.0.0 --baseURL=http://localhost --port 1314 -D
    ```

2. ailogy 이라는 Github 리포지토리를 만들고 소스를 리포지토리에 업로드 하고 동기화 하세요

3. github 페이지에 배포 하는 workflow 를 작성하세요
    ```yml
    # Sample workflow for building and deploying a Hugo site to GitHub Pages
    name: Deploy Hugo site to Pages

    on:
      # Runs on pushes targeting the default branch
      push:
        branches: ["main"]

      # Allows you to run this workflow manually from the Actions tab
      workflow_dispatch:

    # Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
    permissions:
      contents: read
      pages: write
      id-token: write

    # Allow only one concurrent deployment, skipping runs queued between the run in-progress and latest queued.
    # However, do NOT cancel in-progress runs as we want to allow these production deployments to complete.
    concurrency:
      group: "pages"
      cancel-in-progress: false

    # Default to bash
    defaults:
      run:
        shell: bash

    jobs:
      # Build job
      build:
        runs-on: ubuntu-latest
        env:
          HUGO_VERSION: 0.128.0
        steps:
          - name: Install Hugo CLI
            run: |
              wget -O ${{ runner.temp }}/hugo.deb https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.deb \
              && sudo dpkg -i ${{ runner.temp }}/hugo.deb
          - name: Install Dart Sass
            run: sudo snap install dart-sass
          - name: Checkout
            uses: actions/checkout@v4
            with:
              submodules: recursive
          - name: Setup Pages
            id: pages
            uses: actions/configure-pages@v5
          - name: Install Node.js dependencies
            run: "[[ -f package-lock.json || -f npm-shrinkwrap.json ]] && npm ci || true"
          - name: Build with Hugo
            env:
              HUGO_CACHEDIR: ${{ runner.temp }}/hugo_cache
              HUGO_ENVIRONMENT: production
            run: |
              hugo \
                --minify \
                --baseURL "${{ steps.pages.outputs.base_url }}/"
          - name: Upload artifact
            uses: actions/upload-pages-artifact@v3
            with:
              path: ./public

      # Deployment job
      deploy:
        environment:
          name: github-pages
          url: ${{ steps.deployment.outputs.page_url }}
        runs-on: ubuntu-latest
        needs: build
        steps:
          - name: Deploy to GitHub Pages
            id: deployment
            uses: actions/deploy-pages@v4
    ```
---
## 4. 쿠버네티스 배포를 위한 EKS 클러스터 생성하기


### 1. Provider 설정    
```terraform
## AWS Provider 설정
provider "aws" {
  # profile = var.terraform_aws_profile
  # access_key = var.aws_access_key_id
  # secret_key = var.aws_secret_access_key
  region = var.aws_region
  default_tags {
    tags = {
      managed_by = "terraform"
    }
  }
}
```

### 2. VPC 생성
```terraform
#########################################################################################################
## Create a VPC
#########################################################################################################
resource "aws_vpc" "vpc" {
  cidr_block           = "10.1.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "${var.cluster_name}-vpc"
  }
}

#########################################################################################################
## Create Public & Private Subnet
#########################################################################################################
resource "aws_subnet" "public-subnet-a" {
  vpc_id                  = aws_vpc.vpc.id
  cidr_block              = "10.1.1.0/24"
  availability_zone       = "ap-northeast-2a"
  map_public_ip_on_launch = true
  tags = {
    Name = "public-0"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                               = "1"
    "kubernetes.io/role/alb"                               = "1"
  }
}

resource "aws_subnet" "public-subnet-c" {
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = "10.1.2.0/24"
  availability_zone = "ap-northeast-2c"
  tags = {
    Name = "public-1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                               = "1"
    "kubernetes.io/role/alb"                               = "1"
  }
}

resource "aws_subnet" "private-subnet-a" {
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = "10.1.3.0/24"
  availability_zone = "ap-northeast-2a"
  tags = {
    Name                                        = "private-0"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"           = "1"
  }
}

resource "aws_subnet" "private-subnet-c" {
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = "10.1.4.0/24"
  availability_zone = "ap-northeast-2c"
  tags = {
    Name                                        = "private-1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"           = "1"
  }
}

#########################################################################################################
## Create Internet gateway & Nat gateway
#########################################################################################################
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.vpc.id
  tags = {
    Name = "${var.cluster_name}-igw"
  }
}

resource "aws_eip" "nat-eip" {
  domain = "vpc"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_nat_gateway" "nat-gateway" {
  subnet_id     = aws_subnet.public-subnet-a.id
  allocation_id = aws_eip.nat-eip.id
  tags = {
    Name = "${var.cluster_name}-nat-gateway"
  }
}

#########################################################################################################
## Create Route Table & Route
#########################################################################################################
resource "aws_route_table" "public-rtb" {
  vpc_id = aws_vpc.vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = {
    Name = "${var.cluster_name}-public-rtb"
  }
}


resource "aws_route_table_association" "public-rtb-assoc1" {
  route_table_id = aws_route_table.public-rtb.id
  subnet_id      = aws_subnet.public-subnet-a.id
}

resource "aws_route_table_association" "public-rtb-assoc2" {
  route_table_id = aws_route_table.public-rtb.id
  subnet_id      = aws_subnet.public-subnet-c.id
}


resource "aws_route_table" "private-rtb" {
  vpc_id = aws_vpc.vpc.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat-gateway.id
  }
  tags = {
    Name = "${var.cluster_name}-private-rtb"
  }
}

resource "aws_route_table_association" "private-rtb-assoc1" {
  route_table_id = aws_route_table.private-rtb.id
  subnet_id      = aws_subnet.private-subnet-a.id
}

resource "aws_route_table_association" "private-rtb-assoc2" {
  route_table_id = aws_route_table.private-rtb.id
  subnet_id      = aws_subnet.private-subnet-c.id
}
```
### 3. Security Group 생성
```terraform
#########################################################################################################
## Create Security Group
#########################################################################################################
resource "aws_security_group" "allow-ssh-sg" {
  name        = "allow-ssh"
  description = "allow ssh"
  vpc_id      = aws_vpc.vpc.id
}

resource "aws_security_group_rule" "allow-ssh" {
  from_port         = 22
  protocol          = "tcp"
  security_group_id = aws_security_group.allow-ssh-sg.id
  to_port           = 22
  type              = "ingress"
  description       = "ssh"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group" "public-sg" {
  name        = "public-sg"
  description = "allow all ports"
  vpc_id      = aws_vpc.vpc.id
}

resource "aws_security_group_rule" "allow-all-ports" {
  from_port         = 0
  protocol          = "-1"
  security_group_id = aws_security_group.public-sg.id
  to_port           = 0
  type              = "ingress"
  description       = "all ports"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "allow-all-ports-egress" {
  from_port         = 0
  protocol          = "-1"
  security_group_id = aws_security_group.public-sg.id
  to_port           = 0
  type              = "egress"
  description       = "all ports"
  cidr_blocks       = ["0.0.0.0/0"]
}
```
### 4. IAM Role 생성
```terraform
resource "aws_iam_role" "ec2_role" {
    
  name = "cwave_ec2_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Sid    = ""
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}
# ECR PowerUser 정책 연결
resource "aws_iam_role_policy_attachment" "ecr_poweruser" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
}
######################################################################################################################
# IAM Policy 설정
######################################################################################################################
data "http" "iam_policy" {
  url = "https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.6.2/docs/install/iam_policy.json"
}

resource "aws_iam_role_policy" "cwave-eks-controller" {
  name_prefix = "AWSLoadBalancerControllerIAMPolicy"
  role        = module.lb_controller_role.iam_role_name
  policy      = data.http.iam_policy.response_body
}
```
### 5. Helm 이용 추가 설치
```terraform
######################################################################################################################
# Kubernetes
######################################################################################################################
data "aws_eks_cluster" "cluster" {
  name = module.eks.cluster_name
  depends_on = [module.eks.cluster_name]
}

data "aws_eks_cluster_auth" "cluster" {
  name = module.eks.cluster_name
  depends_on = [module.eks.cluster_name]
}

provider "kubernetes" {
  alias                  = "cwave-eks"
  host                   = data.aws_eks_cluster.cluster.endpoint
  # token                  = data.aws_eks_cluster_auth.cluster.token
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority.0.data)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      var.cluster_name,
      "--region",
      var.aws_region,
      "--profile",
      var.terraform_aws_profile
    ]
  }
}

######################################################################################################################
# 헬름차트
# 쿠버네티스 클러스터 추가 될때마다 alias 를 변경해서 추가해주기
######################################################################################################################
provider "helm" {
  alias = "cwave-eks-helm"

  kubernetes {
    host                   = module.eks.cluster_endpoint
    token                  = data.aws_eks_cluster_auth.eks_cluster_auth.token
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args = [
        "eks",
        "get-token",
        "--cluster-name",
        module.eks.cluster_name,
        "--region",
        var.aws_region,
        "--profile",
        var.terraform_aws_profile
      ]
    }
  }
}

########################################################################################
#   Helm release : alb
########################################################################################
resource "helm_release" "eks_common_alb" {
  provider   = helm.cwave-eks-helm
  name       = "aws-load-balancer-controller"
  chart      = "aws-load-balancer-controller"
  version    = "1.6.2"
  repository = "https://aws.github.io/eks-charts"
  namespace  = "kube-system"

  dynamic "set" {
    for_each = {
      "clusterName"                                               = var.cluster_name
      "serviceAccount.create"                                     = "true"
      "serviceAccount.name"                                       = "aws-load-balancer-controller"
      "region"                                                    = var.aws_region
      "vpcId"                                                     = aws_vpc.vpc.id
      "image.repository"                                          = "602401143452.dkr.ecr.${var.aws_region}.amazonaws.com/amazon/aws-load-balancer-controller"
      "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn" = module.lb_controller_role.iam_role_arn
    }

    content {
      name  = set.key
      value = set.value
    }
  }
  depends_on = [
    module.eks,
    module.lb_controller_role
  ]
}
########################################################################################
#   Helm release : efs csi driver
########################################################################################

resource "helm_release" "aws_efs_csi_driver" {
  provider   = helm.cwave-eks-helm
  chart      = "aws-efs-csi-driver"
  name       = "aws-efs-csi-driver"
  namespace  = "kube-system"
  repository = "https://kubernetes-sigs.github.io/aws-efs-csi-driver/"

  set {
    name  = "image.repository"
    value = "602401143452.dkr.ecr.eu-west-3.amazonaws.com/eks/aws-efs-csi-driver"
  }

  set {
    name  = "controller.serviceAccount.create"
    value = true
  }

  set {
    name  = "controller.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.attach_efs_csi_role.iam_role_arn
  }

  set {
    name  = "controller.serviceAccount.name"
    value = "efs-csi-controller-sa"
  }
}
module "attach_efs_csi_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"

  role_name             = "efs-csi"
  attach_efs_csi_policy = true

  oidc_providers = {
    ex = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:efs-csi-controller-sa"]
    }
  }
}

resource "aws_security_group" "allow_nfs" {
  name        = "allow nfs for efs"
  description = "Allow NFS inbound traffic"
  vpc_id      = aws_vpc.vpc.id

  ingress {
    description = "NFS from VPC"
    from_port   = 2049
    to_port     = 2049
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.vpc.cidr_block]
  }

  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

}


resource "aws_efs_file_system" "stw_node_efs" {
  creation_token = "efs-for-stw-node"
}


resource "aws_efs_mount_target" "stw_node_efs_mt_0" {
  file_system_id  = aws_efs_file_system.stw_node_efs.id
  subnet_id       = aws_subnet.private-subnet-a.id
  security_groups = [aws_security_group.allow_nfs.id]
}

resource "aws_efs_mount_target" "stw_node_efs_mt_1" {
  file_system_id  = aws_efs_file_system.stw_node_efs.id
  subnet_id       = aws_subnet.private-subnet-c.id
  security_groups = [aws_security_group.allow_nfs.id]
}      
```
### 6. variables.tf
```terraform
variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "ap-northeast-2"  # 기본값 설정 (선택사항)
}

variable "vpc_name" {
  description = "name of vpc"
  type        = string
  default     = "dangtong"
}

variable "cluster_name" {
  description = "name of cluster"
  type        = string
  default     = "istory"
}

variable "cluster_version" {
  description = "version of cluster"
  type        = string
  default     = "1.31"
}

variable "environment" {
  description = "Environment name (e.g., dev, stg, prd)"
  type        = string
  default     = "dev"  # 필요한 경우 기본값 설정
}

variable "terraform_aws_profile" {
  description = "AWS profile for Terraform"
  type        = string
  default     = "aws-cicd"
}
```
### 6. eks.tf
```terraform
## Create eks cluster
data "aws_caller_identity" "current" {}

module "eks" {
  source          = "terraform-aws-modules/eks/aws"
  version         = "~> 20.29.0"
  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true
  
  # EBS 관련 정책 추가
  iam_role_additional_policies = {
    AmazonEBSCSIDriverPolicy = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
    AmazonEC2FullAccess      = "arn:aws:iam::aws:policy/AmazonEC2FullAccess"
  }
  
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      cluster_name = var.cluster_name
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
      service_account_role_arn = module.ebs_csi_irsa.iam_role_arn
    }
    eks-pod-identity-agent = {
      most_recent = true
    }
  }
  enable_cluster_creator_admin_permissions = true
  vpc_id                   = aws_vpc.vpc.id
  subnet_ids               = [aws_subnet.private-subnet-a.id, aws_subnet.private-subnet-c.id]

  # EKS Managed Node Group
  eks_managed_node_group_defaults = {
    instance_types = ["t3.medium"]
  }

  eks_managed_node_groups = {
    green = {
      min_size     = 2
      max_size     = 5
      desired_size = 2

      instance_types = ["t3.medium"]
      iam_role_additional_policies = {
        # AWS 관리형 정책 추가
        AmazonEBSCSIDriverPolicy = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
      }
    }
  }
}

module "ebs_csi_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.30"

  role_name = "${var.cluster_name}-ebs-csi-controller"

  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }
}

module "vpc_cni_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 4.12"

  role_name_prefix      = "VPC-CNI-IRSA"
  attach_vpc_cni_policy = true
  vpc_cni_enable_ipv4   = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-node"]
    }
    common = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-node"]
    }
  }
}

############################################################################################
## 로드밸런서 콘트롤러 설정
## EKS 에서 Ingress 를 사용하기 위해서는 반듯이 로드밸런서 콘트롤러를 설정 해야함.
## 참고 URL : https://docs.aws.amazon.com/ko_kr/eks/latest/userguide/aws-load-balancer-controller.html
############################################################################################

######################################################################################################################
# 로컬변수
# 쿠버네티스 추가 될때마다 lb_controller_iam_role_name 을 추가해야함.
######################################################################################################################

# locals {
#   # eks 를 위한 role name
#   k8s_aws_lb_service_account_namespace = "kube-system"
#   lb_controller_service_account_name   = "aws-load-balancer-controller"
# }

######################################################################################################################
# EKS 클러스터 인증 데이터 소스 추가
######################################################################################################################

data "aws_eks_cluster_auth" "eks_cluster_auth" {
  name = var.cluster_name
}

# Load Balancer Controller를 위한 IAM Role 생성
module "lb_controller_role" {
  source = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"

  role_name = "eks-aws-lb-controller-role"

  attach_load_balancer_controller_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }
}
```
### 6. .gitignore 파일 생성
```
.terraform.lock.hcl
.terraform
.terraform.tfstate
terraform.tfstate
terraform.tfstate.1732244297.backup
terraform.tfstate.backup
```
---

### 7. Terraform 적용
```bash
terraform init
terraform plan
terraform apply
``` 

### 8. 리포지토리 동기화
```bash
git add .
git commit -m "add terraform"
git push origin main
```
---
## 5. Simple WEB 쿠버네티스에 메뉴얼 배포하기

### 1. Docker 파일 작성
```dockerfile
FROM nginx:alpine

# 기존 nginx 기본 페이지 제거
RUN rm -rf /usr/share/nginx/html/*

# 웹 파일들을 컨테이너로 복사
COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY scripts/ /usr/share/nginx/html/scripts/

# nginx 포트 노출
EXPOSE 80

# nginx 실행
CMD ["nginx", "-g", "daemon off;"]
```
### 2. 컨테이너 이미지 빌드
```bash
docker build -t <your-dockerhub-id>/simple-web .
```
### 3. 컨테이너 이미지 푸시
```bash
docker login --username <your-dockerhub-id>
docker push <your-dockerhub-id>/simple-web
```
### 4. 쿠버네티스 배포
1. simple-web-deploy.yaml 파일 생성
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: simple-web
  labels:
    app: simple-web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: simple-web
  template:
    metadata:
      labels:
        app: simple-web
    spec:
      containers:
        - name: simple-web
          image: <your-dockerhub-id>/simple-web
          ports:
            - containerPort: 80 
```
3. simple-web-ingress.yaml 파일 생성
```yaml
apiVersion: v1
kind: Service
metadata:
  name: simple-web-lb
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: external
    service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: ip
    service.beta.kubernetes.io/aws-load-balancer-scheme: internet-facing
spec:
  type: LoadBalancer
  selector:
    app: simple-web
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 800
  ports:
    - name: simple-web
      protocol: TCP
      port: 80
      targetPort: 80
```
4. 

### 5. Github workflow 작성
```yml
name: simple-web-eks-ci

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

permissions:
  contents: read
  actions: read

jobs:
  build:

    runs-on: ubuntu-latest
    env:
      DOCKER_IMAGE: ${{ secrets.DOCKER_USERNAME }}/simple-web
      DOCKER_TAG: ${{ github.run_number }}

    steps:
      - name: 1.소스코드 다운로드
        uses: actions/checkout@v4 

      - name: 7.Docker Image Build
        run: docker build  -t ${{ secrets.DOCKER_USERNAME }}/simple-web:${{ env.DOCKER_TAG }} .

      - name: 8.Docker Login
        uses: docker/login-action@v3.0.0
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_TOKEN }}
          logout: true

      - name: 9.Docker Push
        run: |
          docker push ${{ secrets.DOCKER_USERNAME }}/simple-web:${{ env.DOCKER_TAG }}

      # 서비스 리포지토리 체크아웃
      - name: 10.서비스 리포지토리 체크아웃
        uses: actions/checkout@v4
        with:
          repository: dangtong-s-inc/simple-service  
          ref: main
          path: .
          token: ${{ secrets.PAT }} 
      
      # 이미지 태그 업데이트
      - name: 11.쿠버네티스 매니페스트 파일 이미지 태그 업데이트
        run: |
          # 파일이 존재하는지 확인
          ls -la
          # 현재 파일 내용 확인
          cat simple-deploy.yaml
          sed -i "s|image: ${{ secrets.DOCKER_USERNAME }}\/simple-web.*|image: ${{ secrets.DOCKER_USERNAME }}\/simple-web:${{ env.DOCKER_TAG }}|g" simple-deploy.yaml
          # 변경된 내용 확인
          cat simple-deploy.yaml
      
      # 변경사항 커밋 및 푸시
      - name: 12.서비스 리포지토리 변경사항 커밋 및 푸시
        run: |
          git config --global user.name 'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
          git commit -am "Update image tag to ${{ env.DOCKER_TAG }}"
          git remote set-url origin https://${{ secrets.PAT }}@github.com/dangtong-s-inc/simple-service.git
          
          git push origin main
```
