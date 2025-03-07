---
title: "CI/CD 시작하기"
weight: 3
description: ""
icon: "article"
date: "2025-02-04T01:15:27+09:00"
lastmod: "2025-02-04T01:15:27+09:00"
draft: false
toc: true
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
1. Job 생성하기
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
2. 워크 플로우 실행하기
    ```bash
    gh workflow run first-workflow --ref main
    ```
3. 워크 플로우 결과 확인하기
    ```bash
    gh workflow list
    gh workflow run first-workflow --ref main
    ```



