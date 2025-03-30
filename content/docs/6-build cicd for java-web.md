---
title: "4. Java 웹사이트 파이프라인 구성"
weight: 4
date: 2025-03-18
draft: false
---
## 1. Istory 로컬 개발 환경 만들기 
 {{< embed-pdf url="/cicd-textbook/pdfs/3nd-week.pdf" >}}
### 1-1.소스 클론 하기
```bash
gh repo fork https://github.com/dangtong-s-inc/istory-app.git
chmod 755 ./gradlew
cd istory-app
mkdir -p xinfra/istory-local
cd xinfra/istory-local
```

### 1-2.Compose로 DB 컨테이너 생성
```yml
version: '3'
services:
  db:
    image: mysql:8.0
    container_name: db
    environment:
      MYSQL_ROOT_PASSWORD: admin123
      MYSQL_DATABASE: istory
      MYSQL_USER: dangtong
      MYSQL_PASSWORD: admin123
    ports:
      - "3306:3306"
    volumes:
      - ./data:/var/lib/mysql
```
### 1-3. application.yml 수정
파일위치 : src/main/resources/application.yml 
```yml
spring:
  datasource:
    url: ${DATABASE_URL:jdbc:mysql://host.docker.internal:3306/istory}
    username: ${MYSQL_USERNAME:root}
    password: ${MYSQL_PASSWORD:admin123}
    driver-class-name: com.mysql.cj.jdbc.Driver
  jpa:
    database-platform: org.hibernate.dialect.MySQLDialect
    hibernate:
      ddl-auto: create-drop
    show-sql: true
  application:
    name: USER-SERVICE
  jwt:
    issuer: user@gmail.com
    secret_key: study-springboot
```

### 1-4 로컬에서 애플리케이션 실행
gradlew 가 위치한 최상위 디렉토리에서 아래 명령어 실행
```bash
gradlew bootRun
```
---
## 2. Istory ec2-single 클라우드 환경 구성

### 2-1 디렉토리 생성
```bash
mkdir -p xinfra/ec2-single
```
### 2-2 .gitignore 파일 생성
파일명 : xinfra/.gitignore
```bash
**/.terraform
**/.terraform.lock.hcl
**/*.tfstate
**/*.tfstate.backup
**/*.sh
```
### 2-3 terraform 파일 작성
1. provider.tf
파일명 : xinfra/ec2-single/provider.tf
    ```terraform
    provider "aws" {
      region = "ap-northeast-2" # 사용할 AWS 리전
    }
    ```

2. vpc.tf
    파일명 : xinfra/ec2-single/vpc.tf
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

3. security-group.tf

    파일명 : xinfra/ec2-single/security-group.tf
    ```terraform
    resource "aws_security_group" "istory_nginx_sg" {
      name_prefix = "istory nginx sg"
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
        from_port   = 8080
        to_port     = 8080
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

    # RDS 보안 그룹 추가
    resource "aws_security_group" "istory_rds_sg" {
      name_prefix = "istory rds sg"
      vpc_id      = aws_vpc.dangtong-vpc.id

      ingress {
        description     = "Allow MySQL from EC2"
        from_port       = 3306
        to_port         = 3306
        protocol        = "tcp"
        security_groups = [aws_security_group.istory_nginx_sg.id]
      }

      egress {
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
      }

      tags = {
        Name = "istory-rds-sg"
      }
    }
    ```

4. ec2.tf
    파일명 : xinfra/ec2-single/ec2.tf
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

    resource "aws_instance" "dev_istory_nginx_instance" {
      subnet_id = aws_subnet.dangtong-vpc-public-subnet["a"].id
      ami             = "ami-08b09b6acd8d62254" # Amazon Linux 2 AMI (리전별로 AMI ID가 다를 수 있음)
      instance_type   = "t2.micro"
      key_name        = aws_key_pair.ec2_key_pair.key_name # AWS에서 생성한 SSH 키 적용
      vpc_security_group_ids = [aws_security_group.istory_nginx_sg.id]
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

                    # JDK 17 설치 (Amazon Corretto)
                    cd /tmp
                    wget https://corretto.aws/downloads/latest/amazon-corretto-17-x64-linux-jdk.rpm
                    yum install -y amazon-corretto-17-x64-linux-jdk.rpm

                    # Java 버전 확인
                    echo "Installed Java version:"
                    java -version

                    # nginx 설치
                    amazon-linux-extras install nginx1 -y
                    systemctl start nginx
                    systemctl enable nginx
                    EOF
      tags = {
        Name        = "istory nginx-server"
        Environment = "Development"
      }
    }

    # 출력: EC2 인스턴스의 퍼블릭 IP 주소
    output "dev_istory_nginx_instance_public_ip" {
      value       = aws_instance.dev_istory_nginx_instance.public_ip
      description = "Public IP of the Nginx EC2 instance"
    }

    # 출력: SSH 접속에 사용할 Private Key
    output "ssh_private_key_pem" {
      value       = tls_private_key.ec2_private_key.private_key_pem
      description = "Private key for SSH access"
      sensitive   = true
    }
    ```

5. iam.tf
    파일명 : xinfra/ec2-single/iam.tf
    ```terraform
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
    ```

6. codedeploy.tf
    파일명 : xinfra/ec2-single/codedeploy.tf
    ```terraform
    # CodeDeploy 애플리케이션 생성
    resource "aws_codedeploy_app" "istory-app" {
      name = "istory-app"
    }

    # CodeDeploy 배포 그룹 생성
    resource "aws_codedeploy_deployment_group" "istory-deploy_group" {
      app_name               = aws_codedeploy_app.istory-app.name
      deployment_group_name  = "istory-deploy-group"
      service_role_arn      = aws_iam_role.codedeploy_service_role.arn

      deployment_style {
        deployment_option = "WITHOUT_TRAFFIC_CONTROL"
        deployment_type   = "IN_PLACE"
      }

      ec2_tag_set {
        ec2_tag_filter {
          key   = "Environment"
          type  = "KEY_AND_VALUE"
          value = "Development"
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
      value       = aws_codedeploy_app.istory-app.name
      description = "Name of the CodeDeploy application"
    }

    # CodeDeploy 배포 그룹 이름 출력
    output "codedeploy_deployment_group_name" {
      value       = aws_codedeploy_deployment_group.istory-deploy_group.deployment_group_name
      description = "Name of the CodeDeploy deployment group"
    } 
    ```
7. s3.tf
    파일명 : xinfra/ec2-single/s3.tf
    ```terraform
    # S3 버킷 생성
    resource "aws_s3_bucket" "istory-deploy-bucket" {
      bucket = "istory-deploy-bucket-${data.aws_caller_identity.current.account_id}"  # 고유한 버킷 이름 필요
    }

    # S3 버킷 버전 관리 설정
    resource "aws_s3_bucket_versioning" "deploy_bucket_versioning" {
      bucket = aws_s3_bucket.istory-deploy-bucket.id
      versioning_configuration {
        status = "Enabled"
      }
    }

    # S3 버킷 이름 출력
    output "istory-deploy-bucket_name" {
      value       = aws_s3_bucket.istory-deploy-bucket.id
      description = "Name of the S3 bucket for deployments"
    }
    ```
8. rds.tf
    파일명 : xinfra/ec2-single/rds.tf
    ```terraform
    # RDS 서브넷 그룹
    resource "aws_db_subnet_group" "istory_db_subnet_group" {
      name       = "istory-db-subnet-group"
      subnet_ids = [for subnet in aws_subnet.dangtong-vpc-public-subnet : subnet.id]

      tags = {
        Name = "istory DB subnet group"
      }
    }

    # RDS 파라미터 그룹
    resource "aws_db_parameter_group" "istory_db_parameter_group" {
      family = "mysql8.0"
      name   = "istory-db-parameter-group"

      parameter {
        name  = "character_set_server"
        value = "utf8mb4"
      }

      parameter {
        name  = "character_set_client"
        value = "utf8mb4"
      }
    }

    # RDS 인스턴스
    resource "aws_db_instance" "istory_db" {
      identifier           = "istory-db"
      engine              = "mysql"
      engine_version      = "8.0"
      instance_class      = "db.t3.micro"
      allocated_storage   = 20
      storage_type        = "gp2"
      
      db_name             = "istory"
      username           = "user"
      password           = "user12345"  # 실제 운영에서는 AWS Secrets Manager 사용 권장
      
      db_subnet_group_name   = aws_db_subnet_group.istory_db_subnet_group.name
      vpc_security_group_ids = [aws_security_group.istory_rds_sg.id]
      
      parameter_group_name = aws_db_parameter_group.istory_db_parameter_group.name
      
      skip_final_snapshot = true  # 개발 환경에서만 사용. 운영에서는 false 권장
      
      backup_retention_period = 7
      backup_window          = "03:00-04:00"
      maintenance_window     = "Mon:04:00-Mon:05:00"

      tags = {
        Name        = "istory"
        Environment = "Development"
      }
    }

    # RDS 엔드포인트 출력
    output "rds_endpoint" {
      value       = aws_db_instance.istory_db.endpoint
      description = "The connection endpoint for the RDS instance"
    }

    output "rds_database_name" {
      value       = aws_db_instance.istory_db.db_name
      description = "The name of the default database"
    }

    output "rds_username" {
      value       = aws_db_instance.istory_db.username
      description = "The master username for the database"
    }
    ```
8. terraform 적용
    ```bash
    terraform init
    terraform plan
    terraform apply
    ```
### 2-4 Istory Single CI 파이프라인 구성
  1. github 환경변수 및 Secret 등록 (dev)
      ```bash
      # secret for github action
      gh api -X PUT repos/dangtong76/istory-app/environments/dev --silent
      gh secret set MYSQL_DATABASE --env dev --body "<database-name>"
      gh secret set AWS_S3_BUCKET --env dev --body "<aws-s3-bucket-name>"
      gh secret set DATABASE_URL --env dev --body "jdbc:mysql://<aws-rds-endpoint-url>:3306/<database-name>"
      gh secret set MYSQL_USER --env dev --body "<db_username>"
      gh secret set MYSQL_PASSWORD --env dev --body "<db_password>"
      gh secret set MYSQL_ROOT_PASSWORD --env dev --body "<db_root_password>"
      gh secret set AWS_ACCESS_KEY_ID --env dev --body "<aws_access_key_id>"
      gh secret set AWS_SECRET_ACCESS_KEY --env dev --body "<aws_secret_access_key>"
      gh variable set AWS_REGION --env dev --body "ap-northeast-2"
      ```
      github.com → istory-app repository → Settings → Environment → dev 에서 아래와 같이 등록된 결과를 볼 수 있습니다.
       {{< figure src="/cicd-textbook/images/3-1.env.png" alt="CodeDeploy 이미지" class="img-fluid" width="40%">}}
  2. Script 작성
      
      파일명 : scripts/before_install.sh
      ```bash
      #!/bin/bash
      if [ -d /home/ec2-user/app ]; then
          rm -rf /home/ec2-user/app/*
      else
          mkdir -p /home/ec2-user/app
      fi
      ```
      파일명 : scripts/start_application.sh
      ```bash
      #!/bin/bash
      cd /home/ec2-user/app

      # 필요한 디렉토리 생성
      mkdir -p /home/ec2-user/app/logs

      # 환경 변수 설정
      export SERVER_PORT=8080
      export JAVA_OPTS="-Xms512m -Xmx1024m"

      # 이전 프로세스 종료 (혹시 모를 중복 실행 방지)
      # if [ -f /home/ec2-user/app/pid.file ]; then
      #     pid=$(cat /home/ec2-user/app/pid.file)
      #     kill -9 $pid || true
      #     rm /home/ec2-user/app/pid.file
      # fi

      # 프로세스 종료
      CURRENT_PID=$(ps -ef | grep '[j]ava -jar springboot' | awk '{print $2}')
      if [ -z "$CURRENT_PID" ]; then
          echo "No spring boot application is running."
      else
          echo "Kill process: $CURRENT_PID"
          kill -15 $CURRENT_PID
          sleep 5
          if ps -p $CURRENT_PID > /dev/null; then
              echo "Process $CURRENT_PID did not terminate, killing forcefully"
              kill -9 $CURRENT_PID
          fi
          echo "Process $CURRENT_PID stopped"
      fi


      # 애플리케이션 시작
      cd /home/ec2-user/app
      nohup java -jar *.jar > /home/ec2-user/app/logs/application.log 2>&1 &
      echo $! > /home/ec2-user/app/pid.file

      # 시작 대기
      sleep 10
      ```
      파일명 : scripts/stop_application.sh
      ```bash
      #!/bin/bash
      # 이전 프로세스 종료
      CURRENT_PID=$(pgrep -f istory-*.jar)

      if [ -z "$CURRENT_PID" ]; then
          echo "No spring boot application is running."
      else
          echo "Kill process: $CURRENT_PID"
          kill -15 $CURRENT_PID
          sleep 5
      fi
      ```
  2. appspec.yml 작성
      ```
      version: 0.0
      os: linux
      files:
        - source: /
          destination: /home/ec2-user/app
      permissions:
        - object: /home/ec2-user/app
          pattern: "**"
          owner: ec2-user
          group: ec2-user
          mode: 755
        - object: /home/ec2-user/app/scripts    # 스크립트 디렉토리
          pattern: "*.sh"
          owner: ec2-user
          group: ec2-user
          mode: 755    # 스크립트 파일에 실행 권한 부여
        - object: /home/ec2-user/app/*.jar      # JAR 파일
          pattern: "*.jar"
          owner: ec2-user
          group: ec2-user
          mode: 755    # JAR 파일에도 실행 권한 필요
      hooks:
        BeforeInstall:
          - location: scripts/before_install.sh
            timeout: 300
            runas: ec2-user
        ApplicationStart:
          - location: scripts/start_application.sh
            timeout: 300
            runas: ec2-user
        ApplicationStop:
          - location: scripts/stop_application.sh
            timeout: 300
            runas: ec2-user
      ```
  2. github action workflow 작성
      파일명 : .github/workflows/ec2-single-deploy.yml
      ```bash
      #1
      name: istory ci/cd dev pipeline

      permissions:
        contents: read
        security-events: write  # CodeQL 결과를 업로드하기 위한 권한
        actions: read

      on:
        push:
          branches: [ "test"]
          paths:
            - 'xinfra/ec2-single/**'
            - '.github/workflows/ec2-single-deploy.yml'
            - 'scripts/**'
            - 'appspec.yml'
      jobs:
        build-and-upload:
          runs-on: ubuntu-latest
          environment: dev # 환경변수 설정 확인
          steps:
            - name: 배포용 소스 다운로드
              uses: actions/checkout@v4

            - name: 개발용 application.yml 생성
              run: |
                cat > src/main/resources/application.yml << EOF
                spring:
                  datasource:
                    url: ${{ secrets.DATABASE_URL }} # 예dbc:mysql://localhost:3306/istory
                    username: ${{ secrets.MYSQL_USER }}
                    password: ${{ secrets.MYSQL_PASSWORD }}
                    driver-class-name: com.mysql.cj.jdbc.Driver
                  jpa:
                    database-platform: org.hibernate.dialect.MySQL8Dialect
                    hibernate:
                      ddl-auto: update
                    show-sql: true
                  application:
                    name: USER-SERVICE
                  jwt:
                    issuer: user@gmail.com
                    secret_key: study-springboot
                management:
                  endpoints:
                    web:
                      exposure:
                        include: health,info
                  endpoint:
                    health:
                      show-details: always
                EOF

            - name: AWS 접속정보 설정
              uses: aws-actions/configure-aws-credentials@v4
              with:
                aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
                aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
                aws-region: ${{ vars.AWS_REGION }} 

            - name: Set up JDK 17
              uses: actions/setup-java@v4
              with:
                java-version: '17'
                distribution: 'temurin'

            - name: Build with Gradle
              run: |
                chmod +x gradlew
                ./gradlew bootJar

            - name: Generate artifact name with timestamp
              run: |
                echo "ARTIFACT_NAME=springboot-$(date +'%Y%m%d-%H%M%S').jar" >> $GITHUB_ENV

            - name: Create deployment package
              run: |
                mkdir -p deployment/scripts
                cp build/libs/*.jar deployment/${{ env.ARTIFACT_NAME }}
                cp appspec.yml deployment/
                cp scripts/* deployment/scripts/
                chmod +x deployment/scripts/*.sh
                chmod +x deployment/*.jar
                cd deployment && zip -r ../deploy.zip .          

            - name: S3 업로드
              run: |
                # JAR 파일 업로드
                aws s3 cp deployment/${{ env.ARTIFACT_NAME }} s3://${{ secrets.AWS_S3_BUCKET }}/artifacts/
                # 배포 패키지 업로드
                aws s3 cp deploy.zip s3://${{ secrets.AWS_S3_BUCKET }}/deploy/deploy.zip  
            - name: 기존 진행중인 배포 삭제
              run: |
                DEPLOYMENTS=$(aws deploy list-deployments \
                  --application-name istory-app \
                  --deployment-group-name istory-deploy-group \
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
            - name: EC2 배포 수행
              id: deploy
              run: |
                DEPLOYMENT_ID=$(aws deploy create-deployment \
                  --application-name istory-app \
                  --deployment-group-name istory-deploy-group \
                  --s3-location bucket=${{ secrets.AWS_S3_BUCKET }},key=deploy/deploy.zip,bundleType=zip \
                  --output text \
                  --query 'deploymentId')
                echo "deployment_id=${DEPLOYMENT_ID}" >> $GITHUB_OUTPUT

            - name: 배포 최종 성공 확인
              run: |
                aws deploy wait deployment-successful --deployment-id ${{ steps.deploy.outputs.deployment_id }}
      ```
## 3. Istory ec2-scaling 환경 구성
### 3-1 디렉토리 생성
```bash
mkdir -p xinfra/ec2-scaling
```
### 3-2 creat-secret.sh 작성
파일 : xinfra/ec2-scaling/create-secret-stage.sh
```bash
# secret for github action
gh api -X PUT repos/dangtong76/istory-app/environments/stage  --silent
gh secret set MYSQL_DATABASE --env stage --body "<database-name>"
gh secret set AWS_S3_BUCKET --env stage --body "<aws-s3-bucket-name>"
gh secret set DATABASE_URL --env stage --body "jdbc:mysql://<aws-rds-endpoint-url>:3306/<database-name>"
gh secret set MYSQL_USER --env stage --body "<db_username>"
gh secret set MYSQL_PASSWORD --env stage --body "<db_password>"
gh secret set MYSQL_ROOT_PASSWORD --env stage --body "<db_root_password>"
gh secret set AWS_ACCESS_KEY_ID --env stage --body "<aws_access_key_id>"
gh secret set AWS_SECRET_ACCESS_KEY --env stage --body "<aws_secret_access_key>"
gh variable set AWS_REGION --env stage --body "ap-northeast-2"
```

### 3-3 Terraform 파일 작성

1. 기존 ec2-single 내의 파일 복사해오기
    ```bash
    cp xinfra/ec2-single/*.tf xinfra/ec2-scaling/
    ```
2. security-group.tf 파일에 rds 보안 그룹 추가
    파일명 : xinfra/ec2-scaling/security-group.tf
    ```terraform
    # RDS 보안 그룹 추가
    resource "aws_security_group" "istory_rds_sg" {
      name_prefix = "istory rds sg"
      vpc_id      = aws_vpc.dangtong-vpc.id

      ingress {
        description     = "Allow MySQL from EC2"
        from_port       = 3306
        to_port         = 3306
        protocol        = "tcp"
        security_groups = [
          aws_security_group.istory_nginx_sg.id,
          aws_security_group.istory_prod_ec2_sg.id # Autoscaling 그룹 보안 그룹 추가
          ]
      }

      egress {
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
      }

      tags = {
        Name = "istory-rds-sg"
      }
    }
    ```
3. security-group.tf 파일에 내용추가
    ```terraform
    # ALB 보안 그룹
    resource "aws_security_group" "istory_alb_sg" {
      name_prefix = "istory alb sg"
      vpc_id      = aws_vpc.dangtong-vpc.id

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

      tags = {
        Name = "istory-alb-sg"
      }
    }

    # EC2 보안 그룹 수정 - ALB에서만 접근 허용
    resource "aws_security_group" "istory_prod_ec2_sg" {
      name_prefix = "istory prod ec2 sg"
      vpc_id      = aws_vpc.dangtong-vpc.id

      ingress {
        description     = "Allow HTTP from ALB"
        from_port       = 8080
        to_port         = 8080
        protocol        = "tcp"
        security_groups = [aws_security_group.istory_alb_sg.id]
      }

      ingress {
        description = "Allow SSH"
        from_port   = 22
        to_port     = 22
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
      }

      egress {
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
      }

      tags = {
        Name = "istory-prod-ec2-sg"
      }
    }
    ```
4. alb.tf 파일 신규 생성
    ```bash
    # ALB 생성
    resource "aws_lb" "istory_alb" {
      name               = "istory-alb"
      internal           = false
      load_balancer_type = "application"
      security_groups    = [aws_security_group.istory_alb_sg.id]
      subnets           = [for subnet in aws_subnet.dangtong-vpc-public-subnet : subnet.id]

      tags = {
        Name        = "istory-alb"
        Environment = "Production"
      }
    }

    # ALB 타겟 그룹
    resource "aws_lb_target_group" "istory_tg" {
      name     = "istory-tg"
      port     = 8080
      protocol = "HTTP"
      vpc_id   = aws_vpc.dangtong-vpc.id

      health_check {
        enabled             = true
        healthy_threshold   = 2
        interval            = 30
        matcher            = "302"
        path               = "/actuator/health"
        port               = "traffic-port"
        timeout            = 5
        unhealthy_threshold = 2
      }
    }

    # ALB 리스너
    resource "aws_lb_listener" "istory_listener" {
      load_balancer_arn = aws_lb.istory_alb.arn
      port              = 80
      protocol          = "HTTP"

      default_action {
        type             = "forward"
        target_group_arn = aws_lb_target_group.istory_tg.arn
      }
    } 
    ```
5. EC2 Auto Ascaling 그룹 추가 
    파일명 : xinfra/ec2-scaling/launch-template.tf
    ```terraform
    # Launch Template
    resource "aws_launch_template" "istory_lt" {
      name_prefix   = "istory-lt"
      image_id      = "ami-08b09b6acd8d62254"
      instance_type = "t3.small"

      network_interfaces {
        associate_public_ip_address = true
        security_groups            = [aws_security_group.istory_prod_ec2_sg.id]
      }

      iam_instance_profile {
        name = aws_iam_instance_profile.ec2_profile.name
      }

      user_data = base64encode(<<-EOF
                  #!/bin/bash
                  yum update -y
                  yum install -y ruby wget
                  cd /home/ec2-user
                  wget https://aws-codedeploy-ap-northeast-2.s3.ap-northeast-2.amazonaws.com/latest/install
                  chmod +x ./install
                  ./install auto
                  systemctl start codedeploy-agent
                  systemctl enable codedeploy-agent
                  cd /tmp
                  wget https://corretto.aws/downloads/latest/amazon-corretto-17-x64-linux-jdk.rpm
                  yum install -y amazon-corretto-17-x64-linux-jdk.rpm
                  EOF
      )

      tag_specifications {
        resource_type = "instance"
        tags = {
          Name        = "istory-prod"
          Environment = "Production"
        }
      }
    }
    ```
6. Auto Scaling Group 생성
    파일명 : xinfra/ec2-scaling/autoscaling.tf
    ```terraform
    # Auto Scaling Group
    resource "aws_autoscaling_group" "istory_asg" {
      name                = "istory-asg"
      desired_capacity    = 2
      max_size            = 4
      min_size            = 2
      target_group_arns   = [aws_lb_target_group.istory_tg.arn]
      vpc_zone_identifier = [for subnet in aws_subnet.dangtong-vpc-public-subnet : subnet.id]

      launch_template {
        id      = aws_launch_template.istory_lt.id
        version = "$Latest"
      }

      tag {
        key                 = "Environment"
        value               = "Production"
        propagate_at_launch = true
      }
    }
    ```
6. AutoScaling 용 Deploy Group 생성
    파일명 : xinfra/ec2-scaling/codedeploy.tf
    ```terraform
    resource "aws_codedeploy_deployment_group" "istory_prod_deploy_group" {
      app_name               = aws_codedeploy_app.istory-app.name
      deployment_group_name  = "istory-prod-deploy-group"
      service_role_arn      = aws_iam_role.codedeploy_service_role.arn

      deployment_style {
        deployment_option = "WITH_TRAFFIC_CONTROL"
        deployment_type   = "IN_PLACE"
      }

      load_balancer_info {
        target_group_info {
          name = aws_lb_target_group.istory_tg.name
        }
      }

      auto_rollback_configuration {
        enabled = true
        events  = ["DEPLOYMENT_FAILURE"]
      }

      ec2_tag_set {
        ec2_tag_filter {
          key   = "Environment"
          type  = "KEY_AND_VALUE"
          value = "Production"
        }
      }

      trigger_configuration {
        trigger_events = ["DeploymentSuccess", "DeploymentFailure"]
        trigger_name   = "prod-deployment-trigger"
        trigger_target_arn = aws_sns_topic.deployment_notifications.arn
      }

      alarm_configuration {
        enabled = true
        alarms  = ["istory-prod-deployment-alarm"]
      }
    }

    # SNS 토픽 생성
    resource "aws_sns_topic" "deployment_notifications" {
      name = "istory-deployment-notifications"
    }

    output "prod_alb_dns" {
      value       = aws_lb.istory_alb.dns_name
      description = "The DNS name of the production ALB"
    }

    output "prod_deployment_group_name" {
      value       = aws_codedeploy_deployment_group.istory_prod_deploy_group.deployment_group_name
      description = "Name of the production CodeDeploy deployment group"
    }
    ```
7. s3.tf 파일에 추가
    파일명 : xinfra/ec2-scaling/s3.tf
    ```terraform
    # 운영용 S3 버킷
    resource "aws_s3_bucket" "istory-prod-deploy-bucket" {
      bucket = "istory-prod-deploy-bucket-${data.aws_caller_identity.current.account_id}"
      tags = {
        Name        = "istory-deploy-prod"
        Environment = "Production"
      }
    }

    # 운영용 버킷 버전 관리
    resource "aws_s3_bucket_versioning" "prod_deploy_bucket_versioning" {
      bucket = aws_s3_bucket.istory-prod-deploy-bucket.id
      versioning_configuration {
        status = "Enabled"
      }
    }

    # 운영용 버킷 서버사이드 암호화
    resource "aws_s3_bucket_server_side_encryption_configuration" "prod_bucket_encryption" {
      bucket = aws_s3_bucket.istory-prod-deploy-bucket.id

      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm = "AES256"
        }
      }
    }

    # 운영용 버킷 퍼블릭 액세스 차단
    resource "aws_s3_bucket_public_access_block" "prod_bucket_access" {
      bucket = aws_s3_bucket.istory-prod-deploy-bucket.id

      block_public_acls       = true
      block_public_policy     = true
      ignore_public_acls      = true
      restrict_public_buckets = true
    }

    output "prod_deploy_bucket_name" {
      value       = aws_s3_bucket.istory-prod-deploy-bucket.id
      description = "Name of the production deployment S3 bucket"
    }
    ```
8. terraform 적용
    ```bash
    terraform init
    terraform plan
    terraform apply
    ```
### 3-4 Istory Scaling CI 파이프라인 구성

    파일명 : .github/workflows/ec2-scaling-deploy.yml

    ```yml
    #5
    name: istory scaling ci/cd pipeline

    permissions:
      contents: read
      security-events: write  # CodeQL 결과를 업로드하기 위한 권한
      actions: read

    on:
      push:
        branches: [ "test"]
        paths:
          - 'xinfra/ec2-scaling/**'
          - '.github/workflows/ec2-scaling-deploy.yml'
          - 'scripts/**'
          - 'appspec.yml'
    jobs:
      build-and-upload:
        runs-on: ubuntu-latest
        environment: prod
        steps:
          - name: 배포용 소스 다운로드
            uses: actions/checkout@v4

          - name: 개발용 application.yml 생성
            run: |
              cat > src/main/resources/application.yml << EOF
              spring:
                datasource:
                  url: ${{ secrets.DATABASE_URL }} # 예dbc:mysql://localhost:3306/istory
                  username: ${{ secrets.MYSQL_USER }}
                  password: ${{ secrets.MYSQL_PASSWORD }}
                  driver-class-name: com.mysql.cj.jdbc.Driver
                jpa:
                  database-platform: org.hibernate.dialect.MySQL8Dialect
                  hibernate:
                    ddl-auto: update
                  show-sql: true
                application:
                  name: USER-SERVICE
                jwt:
                  issuer: user@gmail.com
                  secret_key: study-springboot
              management:
                endpoints:
                  web:
                    exposure:
                      include: health,info
                endpoint:
                  health:
                    show-details: always
              EOF

          - name: AWS 접속정보 설정
            uses: aws-actions/configure-aws-credentials@v4
            with:
              aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
              aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
              aws-region: ${{ vars.AWS_REGION }} 

          - name: Set up JDK 17
            uses: actions/setup-java@v4
            with:
              java-version: '17'
              distribution: 'temurin'

          - name: Build with Gradle
            run: |
              chmod +x gradlew
              ./gradlew bootJar

          - name: Generate artifact name with timestamp
            run: |
              echo "ARTIFACT_NAME=springboot-$(date +'%Y%m%d-%H%M%S').jar" >> $GITHUB_ENV

          - name: Create deployment package
            run: |
              mkdir -p deployment/scripts
              cp build/libs/*.jar deployment/${{ env.ARTIFACT_NAME }}
              cp appspec.yml deployment/
              cp scripts/* deployment/scripts/
              chmod +x deployment/scripts/*.sh
              chmod +x deployment/*.jar
              cd deployment && zip -r ../deploy.zip .          

          - name: S3 업로드
            run: |
              # JAR 파일 업로드
              aws s3 cp deployment/${{ env.ARTIFACT_NAME }} s3://${{ secrets.AWS_S3_BUCKET }}/artifacts/
              # 배포 패키지 업로드
              aws s3 cp deploy.zip s3://${{ secrets.AWS_S3_BUCKET }}/deploy/deploy.zip  
          - name: 기존 진행중인 배포 삭제
            run: |
              DEPLOYMENTS=$(aws deploy list-deployments \
                --application-name istory-app \
                --deployment-group-name istory-prod-deploy-group \
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
          - name: EC2 배포 수행
            id: deploy
            run: |
              DEPLOYMENT_ID=$(aws deploy create-deployment \
                --application-name istory-app \
                --deployment-group-name istory-prod-deploy-group \
                --s3-location bucket=${{ secrets.AWS_S3_BUCKET }},key=deploy/deploy.zip,bundleType=zip \
                --deployment-config-name CodeDeployDefault.OneAtATime \
                --output text \
                --query 'deploymentId')
              echo "deployment_id=${DEPLOYMENT_ID}" >> $GITHUB_OUTPUT

          - name: 배포 최종 성공 확인
            run: |
              aws deploy wait deployment-successful --deployment-id ${{ steps.deploy.outputs.deployment_id }}
    ```
AutoScaling 그룹에 대한 배포시에 배포 옵션으로 CodeDeployDefault.EC2InPlaceAllAtOnce , CodeDeployDefault.OneAtATime , CodeDeployDefault.AllAtOnce 3가지 옵션 참고

## 4. Istory ec2-blue-green 환경 구성
### 4-1 디렉토리 생성
```bash
mkdir -p xinfra/ec2-blue-green
```
### 4-2 create-secret.sh 작성
파일 : xinfra/ec2-blue-green/create-secret-stage.sh
```bash
# secret for github action
gh api -X PUT repos/dangtong76/istory-app/environments/prod  --silent
gh secret set MYSQL_DATABASE --env prod --body "<database-name>"
gh secret set AWS_S3_BUCKET --env prod --body "<aws-s3-bucket-name>"
gh secret set DATABASE_URL --env prod --body "jdbc:mysql://<aws-rds-endpoint-url>:3306/<database-name>"
gh secret set MYSQL_USER --env prod --body "<db_username>"
gh secret set MYSQL_PASSWORD --env prod --body "<db_password>" 
gh secret set MYSQL_ROOT_PASSWORD --env prod --body "<db_root_password>"
gh secret set AWS_ACCESS_KEY_ID --env prod --body "<aws_access_key_id>"
gh secret set AWS_SECRET_ACCESS_KEY --env prod --body "<aws_secret_access_key>"
gh variable set AWS_REGION --env prod --body "ap-northeast-2"
```
### 4-3 terraform 파일 작성
1. 기존 ec2-scaling 내의 파일 복사해오기
    ```bash
    cp xinfra/ec2-scaling/*.tf xinfra/ec2-blue-green/
    ```
2.   
### 4-4 istory blue-green ci 파이프라인 구성
```yml
name: istory ci test

on:
  push:
    branches: [ "test"]
    paths:
      - '.github/workflows/ec2-ci.yml'
      - 'scripts/**'
      - 'appspec.yml'
jobs:
  verify_pipeline:
    environment: action
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          # root 계정 비밀번호
          MYSQL_ROOT_PASSWORD: ${{ secrets.MYSQL_ROOT_PASSWORD }}
          # 사용자 계정
          MYSQL_USER: ${{ secrets.MYSQL_USER }}
          # 사용자 계정 비밀번호
          MYSQL_PASSWORD: ${{ secrets.MYSQL_PASSWORD }}
          # 사용자 계정 데이터베이스
          MYSQL_DATABASE: ${{ secrets.MYSQL_DATABASE }}
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
    steps:
    - name: Source Code Checkout
      uses: actions/checkout@v4 

    - name: Set up JDK 17
      uses: actions/setup-java@v4
      with:
        java-version: '17'
        distribution: 'temurin'
    - name: Generate Basic Info in Markdown
      run: |
        echo "## 워크플로우 실행 정보 요약" >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        echo "* 실행 담당자: ${{ github.actor }}" >> $GITHUB_STEP_SUMMARY
        echo "* 실행 이벤트: ${{ github.event_name }}" >> $GITHUB_STEP_SUMMARY
        echo "* 실행 저장소: ${{ github.repository }}" >> $GITHUB_STEP_SUMMARY
        echo "* 실행 브랜치: ${{ github.ref }}" >> $GITHUB_STEP_SUMMARY
```
## 5. CI 파이프라인 프로세스 추가
### 5-1. 코스 스타일링 준수 검사
1. 디렉토리 생성
    ```bash
    mkdir -p config/checkstyle
    ```
1. build.gradle 에 checkstyle plugin 추가 하기
    ```
    plugins {
        id 'checkstyle'
        id 'java'
        id 'org.springframework.boot' version '3.2.0'
        id 'io.spring.dependency-management' version '1.1.4'
    }

    checkstyle {
        toolVersion = '10.12.1'
        configFile = file("${rootDir}/config/checkstyle/checkstyle.xml")
        ignoreFailures = true
        maxWarnings = 100
    }
    tasks.register('checkstyleReport') {
        dependsOn 'checkstyleMain', 'checkstyleTest'
        doLast {
            println "Checkstyle 리포트 위치:"
            println "메인 소스: build/reports/checkstyle/main.html"
            println "테스트 소스: build/reports/checkstyle/test.html"
        }
    }
    ```
2. config/checkstyle.xml 로 스타일 표준 만들기

    네이밍 Conventions : https://checkstyle.sourceforge.io/checks/naming/index.html 참조

    Import Checks : https://checkstyle.sourceforge.io/checks/imports/index.html 참조

    White Space: https://checkstyle.sourceforge.io/checks/whitespace/index.html 참조
    ```xml
    <?xml version="1.0"?>
    <!DOCTYPE module PUBLIC
              "-//Checkstyle//DTD Checkstyle Configuration 1.3//EN"
              "https://checkstyle.org/dtds/configuration_1_3.dtd">

    <module name="Checker">
        <property name="severity" value="warning"/>
        <property name="fileExtensions" value="java, properties, xml"/>

        <!-- Excludes all 'module-info.java' files -->
        <module name="BeforeExecutionExclusionFileFilter">
            <property name="fileNamePattern" value="module\-info\.java$"/>
        </module>

        <module name="TreeWalker">
            <!-- Checks for Naming Conventions -->
            <module name="ConstantName"/>
            <module name="LocalFinalVariableName"/>
            <module name="LocalVariableName"/>
            <module name="MemberName"/>
            <module name="MethodName"/>
            <module name="PackageName"/>
            <module name="ParameterName"/>
            <module name="StaticVariableName"/>
            <module name="TypeName"/>

            <!-- Checks for imports -->
            <module name="AvoidStarImport"/>
            <module name="IllegalImport"/>
            <module name="RedundantImport"/>
            <module name="UnusedImports"/>

            <!-- Checks for Size Violations -->
            <module name="MethodLength">
                <property name="max" value="100"/>
            </module>
            <module name="ParameterNumber"/>

            <!-- Checks for whitespace -->
            <module name="EmptyForIteratorPad"/>
            <module name="GenericWhitespace"/>
            <module name="MethodParamPad"/>
            <module name="NoWhitespaceAfter"/>
            <module name="NoWhitespaceBefore"/>
            <module name="ParenPad"/>
            <module name="TypecastParenPad"/>
            <module name="WhitespaceAfter"/>
            <module name="WhitespaceAround"/>
        </module>
    </module>
    ```
3. checkstyle 워크플로우 추가
    ```yml
        # 스타일 체크 수행행
        - name: Run Checkstyle
          run: |
            mkdir -p build/reports/checkstyle
            ./gradlew checkstyleMain checkstyleTest --info
            ls -la build/reports/checkstyle || true 
        # 스타일 체크 결과 업로드
        - name: Upload Checkstyle results
          if: always()
          uses: actions/upload-artifact@v4
          with:
            name: checkstyle-report
            path: build/reports/checkstyle/
            retention-days: 14
        # 분석 결과 표시 
        - name: Generate list using Markdown
          run: |
            echo "## 코드 스타일 분석결과" >> $GITHUB_STEP_SUMMARY
            echo "" >> $GITHUB_STEP_SUMMARY
            if [ -f build/reports/checkstyle/main.xml ]; then # 소스분석결과 존재시
              echo "### 소스분석결과" >> $GITHUB_STEP_SUMMARY
              echo '```' >> $GITHUB_STEP_SUMMARY
              cat build/reports/checkstyle/main.xml >> $GITHUB_STEP_SUMMARY
              echo '```' >> $GITHUB_STEP_SUMMARY
            fi
    ```

