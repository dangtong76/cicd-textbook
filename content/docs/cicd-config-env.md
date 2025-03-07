---
title: "1. 환경설정"
weight: 1
date: 2025-02-02
draft: false
#url: "/cicd-config-env/"
---
---
## 내 컴퓨터 실행 환경 준비
이번 챕터 에서는 우리가 실습하기 위해  내 컴퓨터에 최소한의 필수 유틸리티를 설치합니다.
실습을 위한 필수 설치 목록은 아래와 같습니다.
- **Visual Studio Code**
- **Github 클라이언트**
- **컨테이너 런타임**
- **IDE 컨테이너 실행**

### Visual Studio Code 설치
[Visual Studio Code Download](https://code.visualstudio.com/download)

### Git 설치
[Git Download](https://git-scm.com/downloads)

### Github 클라이언트 설치
- CLI 이용한 설치
```bash
# Mac OS
brew install gh
sudo port install gh

# Windows
choco install gh
winget install --id GitHub.cli
```
- 인스톨러를 이용한 설치
인스톨러를 이용한 설치파일은 :  https://github.com/cli/cli/releases/ 에서 다운로드 가능
- gh cli 인증하기
```bash
gh auth login

# 인증 과정은 아래와 같습니다.

# Where do you use GitHub? GitHub.com 선택 ⮐
# What is your preferred protocol for Git operations on this host? HTTPS 선택 ⮐
# Authenticate Git with your GitHub credentials? (Y/n) Y 선택 ⮐
# Login with a web browser ⮐
# First copy your one-time code: XXXX-XXXX (코드를 그대로 복사)
# https://github.com/login/device 에 접속하여 코드 입력 후 인증
```

### 컨테이너 런타임 설치
1. 도커 데스크탑
   
   [Docker Desktop Download](https://www.docker.com/products/docker-desktop/)
2. Podman Desktop
   
   [Podman Desktop Download](https://podman.io/docs/installation)
### IDE 환경 만들기
1. Git 리포지토리 포크 하기
   ```bash
  
   # 직접 리포지토리 방문해서 포크 하기 (https://github.com/dangtong76/devops-cicd)
   # gh 명령어를 이용해서 리포지토리 포크 하기
   gh repo fork --clone=true https://github.com/dangtong76/devops-cicd.git
   
   # 리포지토리 포크 후 로컬 리포지토리 클론 하기
   git clone https://github.com/dangtong76/devops-cicd.git
   ```

2. 도커볼륨 생성
   ```bash
   # 도커볼륨 생성
   docker volume create --opt device="<your-home-directory>\CICD\devops-cicd\ide\local-storage\devops-cicd-apps" --opt o=bind --opt type=none devops-cicd-apps
   
   docker volume create --opt device="<your-home-directory>\CICD\devops-cicd\ide\local-storage\devops-cicd-vscode" --opt o=bind --opt type=none devops-cicd-vscode
   
   # 볼륨 생성 확인
   docker volume ls
   ```
3. 도커 hub 계정 가입하고 IDE 이미지 빌드하기
   [Docker Hub 계정 가입하기](https://hub.docker.com/)

   ```bash
   # Docker Hub 로그인
   docker login --username dangtong76

   # 이미지 빌드
   docker build -t <your-dockerhub-id>/cloud-cicd-ide:latest .

   # 플랫폼 별 이미지 빌드 (옵셔널)
   docker buildx build  --platform linux/amd64,linux/arm64  -t <your-dockerhub-id>/cloud-cicd-ide --push .

   # 이미지 푸시
   docker push <your-dockerhub-id>/cloud-cicd-ide:latest
   ```
4. Docker Compose 이용한 IDE 컨테이너 실행
   ```bash
   # 도커 컴포즈 파일 실행
   docker compose up -d
   ```
5. IDE 접속하기
   http://localhost:8444 에 접속합니다.


### Visual Studio Code Extension 설치

- Thunder client : REST API 용
- Github 관련
  - Github
  - Github Actions
  - Github Pull Requests
- JAVA 관련
   - Debugger for Java
   - Gradle for Java
   - Spring Boot Extension Pack
- HashiCorp Terraform

### Indent 설정하기

VSCode 에서 Manage () → settings → editor.tab 으로 검색해서 → Editor: Tab Size 를 2로 설정










   
   아래는 IDE 컨테이너 환경에 대한 슬라이드 입니다. 
   <iframe src="https://docs.google.com/presentation/d/e/2PACX-1vRwGw0Fcyu00fiL6wtdmW7KNxcaEqu1uT5xZ8Aa_7Wgo409F3qZJwfkgot8983ZQ7Tc_M6r982N8S0p/embed?start=false&loop=false&delayms=3000" frameborder="0" width="960" height="569" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>


<!-- {{< figure src="/images/test.jpeg" alt="test image" >}} -->

