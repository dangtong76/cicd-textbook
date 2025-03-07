---
title: "2. GitHub Action BASIC"
weight: 3
description: ""
icon: "article"
date: "2025-02-04T01:15:27+09:00"
lastmod: "2025-02-04T01:15:27+09:00"
draft: false
toc: true

---

---

### CICD 테스트 리포지토리 생성하기

웹브라우저 IDE의 devops-cicd-apps 디렉토리에서 명령어를 수행 합니다.

```bash
gh auth login
# Where do you use GitHub? GitHub.com 선택 ⮐
# What is your preferred protocol for Git operations on this host? HTTPS 선택 ⮐
# Authenticate Git with your GitHub credentials? (Y/n) Y 선택 ⮐
# Login with a web browser ⮐
# First copy your one-time code: XXXX-XXXX (코드를 그대로 복사)
# https://github.com/login/device 에 접속하여 코드 입력 후 인증

gh repo create cicd-test --public --clone
```

### 첫번째 워크 플로우 만들기

1. 디렉토리와 생성
   
   ```bash
   mkdir -p .github/workflows
   ```

2. Job 생성하기 

   파일명은 .github/workflows/first-workflow.yml 으로 작성 합니다.

    ```yaml
    name: first-workflow
    on: [push]

    jobs:
      shell-cmd-job:
        runs-on: ubuntu-latest
        steps:
          - name: echo Hello
            run: echo "Hello World"
          - name: multiple line cmd
            run: |
              node -v
              npm -v
    ```

3. 리포지토리 동기화 하기
   
   ```bash
   git add .
   git branch -M main
   git commit -m "first-workflow"
   git push origin main
   ```

4. 워크 플로우 결과 확인하기
   
   ```bash
   gh workflow list
   gh run list
   gh run view <run-id> 
   gh workflow run first-workflow --ref main
   
   # 워크 플로우 실행
   # gh workflow run <workflow-name> --ref <branch-name>
   ```

### 병렬작업 및 의존성 작업 추가 하기

1. first-workflow.yaml 파일애 병렬 작업을 추가 합니다. 
   
   ```bash
   parallel-job:
       runs-on: macos-latest
       steps:
         - name: show software version
           run: sw_vers
   ```

2. first-workflow.yaml 파일에 의존성 작업을 추가 합니다.
   
   ```bash
   dependant-job:
       runs-on: windows-latest
       needs: shell-cmd-job
       steps:
         - name: echo a string
           run: Write-Output "Windows String"
         - name: Error Step
           run: doesnotexit
   ```

3. 리포지토리 동기화
   
   ```bash
   git status
   git commit -am "add jobs"
   git push origin main
   ```

4. 워크플로우 로그 확인하기
   
   ```bash
   gh workflow list
   gh run list
   gh run view <run-id> 
   ```

### 연습문제 2-1

다음 요구사항에 맞는 GitHub Actions 워크플로우 파일을 작성하세요:

- 워크플로우 이름은 "first-exercise-workflow"로 설정
- push와 pull_request 이벤트에서 실행되도록 설정
- ubuntu-latest 환경에서 실행
- Python 버전을 출력하고, pip 버전을 확인하는 단계 포함 (python —version, pip —version)



### 워크 플로우 명령어 사용하기
1. 로그 레벨 별 메시지 출력
    
    각각 에러, 디버그, 경고, 알림 메시지를 출력합니다.
    ```yaml
    name: Workflow CMD - Error Level
    on: [push]

    jobs:
      testing-wf-commands:
        runs-on: ubuntu-latest
        steps:
          - name: Setting an error message
            run: echo "::error::Missing semicolon"
          - name: Setting a debug message with params  
            run: echo "::debug::Missing Semicolon"
          - name: Setting an warning message with params
            run: echo "::warning::Missing Semicolon"
          - name: Setting an notice message with params
            run: echo "::notice::Missing Semicolon"
    ```
2. 로그 그룹으로 지정하기

   로그를 묵어서 한번에 출력 합니다.
   ```yaml
    name: Workflow Commands
    on: [push]

    jobs:
      testing-wf-commands:
        runs-on: ubuntu-latest
        steps:
          - name: Setting an error message
            run: echo "::error::Missing semicolon"
          - name: Setting a debug message with params 
            run: echo "::debug::Missing Semicolon"
          - name: Setting an warning message with params
            run: echo "::warnin::Missing Semicolon"
          - name: Setting an notice message with params
            run: echo "::notice::Missing Semicolon"
          - name: Group of logs
            run: |
              echo "::group::My group title"
              echo "Inside group"
              echo "Inside group 2"
              echo "Inside group 3"
              echo "::endgroup::"
   ```  
3. 워킹 디렉토리 지정과 쉘사용
