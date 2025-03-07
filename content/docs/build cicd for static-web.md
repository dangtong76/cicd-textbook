---

title: "3. 정적 웹사이트 파이프라인 구성"
weight: 3
date: 2025-02-02
draft: false
#url: "/cicd-config-env/"

---

---

Simple Web 은 정적 웹 페이지로 구성된 프로젝트입니다. 이번장에서는 가장 단순한 현태의 애플리케이션을 AWS 에 배포하는 파이프라인을 구성합니다.

파이프라인 구성시에 사용되는 **기술 스택**은 아래와 같습니다.

- Terraform
- GitHub Actions
- AWS S3
- AWS CodeDeploy

### 프로젝트 포크 하기

1. GitHub 에서 프로젝트 포크

   GitHub [simple-web](https://github.com/dangtong76/simple-web) 에서 프로젝트 포크 → 포크 버튼 클릭 → 포크 이름 입력 → 포크 생성

2. gh 명령어를 이용한 포크
    ```bash
    gh auth status

    gh auth switch # 필요 하다면 수행 

    gh repo fork https://github.com/dangtong76/simple-web.git
    ```
3. 리포지토리 클론
    ```bash
    git clone --branch start --single-branch https://github.com/dangtongs/simple-web.git simple-web-app
    cd simple-web-app
    ```
4. 워크플로우 디렉토리 생성
    ```bash
    mkdir -p .github/workflows
    mkdir -p .github/xinfra/aws-ec2-single
    git add .
    git commit -am "add workflow directory"
    git push origin start
    ```
   
### AWS 자격증명 생성 및 입력

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
### Terraform 코드 생성
1. 코드 작성 (xinfra/aws-ec2-single/main.tf)
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

