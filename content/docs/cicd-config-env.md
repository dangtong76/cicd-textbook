---
title: "환경설정"
weight: 1
date: 2025-02-02
draft: false
#url: "/cicd-config-env/"
---
---
## 내 컴퓨터 실행 환경 준비
이번 챕터 에서는 우리가 실습하기 위해  내 컴퓨터에 최소한의 필수 유틸리티를 설치합니다.
실습을 위한 필수 설치 목록은 아래와 같습니다.
- **Github 클라이언트**
- **컨테이너 런타임**
- **IDE 컨테이너 실행**
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
### 컨테이너 런타임 설치
1. 도커 데스크탑
   
   [Docker Desktop Download](https://www.docker.com/products/docker-desktop/)
2. Podman Desktop
   
   [Podman Desktop Download](https://podman.io/docs/installation)
### IDE 환경 만들기
1. Git 리포지토리 포크 하기
   ```bash
   gh repo fork --clone=true https://github.com/dangtong76/devops-cicd.git
   ```

1. 컨테이너 실행
   
   아래는 IDE 컨테이너 환경에 대한 슬라이드 입니다. 
   <iframe src="https://docs.google.com/presentation/d/e/2PACX-1vRwGw0Fcyu00fiL6wtdmW7KNxcaEqu1uT5xZ8Aa_7Wgo409F3qZJwfkgot8983ZQ7Tc_M6r982N8S0p/embed?start=false&loop=false&delayms=3000" frameborder="0" width="960" height="569" allowfullscreen="true" mozallowfullscreen="true" webkitallowfullscreen="true"></iframe>


<!-- {{< figure src="/images/test.jpeg" alt="test image" >}} -->

2. Github 에서 리포지토리 Fork 하기
   
   안녕하세요