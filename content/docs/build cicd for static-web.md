---
title: "3. 정적 웹사이트 파이프라인 구성"
weight: 3
date: 2025-02-02
draft: false
#url: "/cicd-config-env/"

---
---
## 구축을 위한 디자인 컨셉
  {{< embed-pdf url="/cicd-textbook/pdfs/codedeploy.pdf" >}}

---
## Simple Web 무식하게 배포하기
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
## Simple Web 현명하게 배포하기
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
    ```hcl
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

