---
title: "7. 쿠버네티스 배포-인프라 구성"
weight: 7
date: 2025-03-18
draft: false
---
## 7-1. Provider 생성
파일명 : xinfra/istory-infra/aws/000_provider.rf
```terraform
## AWS Provider 설정
provider "aws" {
  # profile = var.terraform_aws_profile
  region = var.aws_region
  default_tags {
    tags = {
      managed_by = "terraform"
    }
  }
}
```

## 7-2. 네트워크 생성
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
## 7-3. EKS 생성

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
## 7-4. IAM 생성
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

# EKS Namespace IAM Roles
resource "aws_iam_role" "eks_namespace_role" {
  for_each = var.eks_namespace_roles

  name = "eks-namespace-${each.value.name}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = each.value.environment
    ManagedBy   = "terraform"
  }
}

# Attach basic policies to namespace roles
resource "aws_iam_role_policy_attachment" "eks_namespace_policy" {
  for_each = var.eks_namespace_roles

  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_namespace_role[each.key].name
}

# Attach additional policies if specified
resource "aws_iam_role_policy_attachment" "eks_namespace_additional_policies" {
  for_each = {
    for policy in flatten([
      for ns_key, ns in var.eks_namespace_roles : [
        for policy in ns.additional_policies : {
          ns_key = ns_key
          policy = policy
        }
      ]
    ]) : "${policy.ns_key}-${policy.policy}" => policy
  }

  policy_arn = each.value.policy
  role       = aws_iam_role.eks_namespace_role[each.value.ns_key].name
}
```

## 7-4. Helm 리포지토리 생성
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
      var.aws_region
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
## 7-5. EKS Namespace 생성
```terraform
# Kubernetes Provider Configuration
provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token
}

# Istory Development Namespace
resource "kubernetes_namespace" "istory_dev" {
  metadata {
    name = "istory-dev"
    
    labels = {
      environment = "development"
      app         = "istory"
      managed-by  = "terraform"
    }
    
    annotations = {
      "creator"                = "terraform"
      "team"                   = "devops"
      "environment-type"       = "development"
      "iam.amazonaws.com/role" = aws_iam_role.eks_namespace_role["istory-dev"].arn
    }
  }
}

# Resource Quota for Dev Namespace
resource "kubernetes_resource_quota" "istory_dev_quota" {
  metadata {
    name      = "istory-dev-quota"
    namespace = kubernetes_namespace.istory_dev.metadata[0].name
  }

  spec {
    hard = {
      "requests.cpu"    = "4"
      "requests.memory" = "8Gi"
      "limits.cpu"      = "8"
      "limits.memory"   = "16Gi"
      "pods"           = "20"
    }
  }
}

# LimitRange for Dev Namespace
resource "kubernetes_limit_range" "istory_dev_limits" {
  metadata {
    name      = "istory-dev-limits"
    namespace = kubernetes_namespace.istory_dev.metadata[0].name
  }

  spec {
    limit {
      type = "Container"
      default = {
        cpu    = "500m"
        memory = "512Mi"
      }
      default_request = {
        cpu    = "100m"
        memory = "256Mi"
      }
      max = {
        cpu    = "2"
        memory = "2Gi"
      }
      min = {
        cpu    = "50m"
        memory = "64Mi"
      }
    }
  }
}

# Istory Production Namespace
resource "kubernetes_namespace" "istory_prod" {
  metadata {
    name = "istory-prod"
    
    labels = {
      environment = "production"
      app         = "istory"
      managed-by  = "terraform"
    }
    
    annotations = {
      "creator"                = "terraform"
      "team"                   = "devops"
      "environment-type"       = "production"
      "iam.amazonaws.com/role" = aws_iam_role.eks_namespace_role["istory-prod"].arn
    }
  }
}

# Resource Quota for Prod Namespace
resource "kubernetes_resource_quota" "istory_prod_quota" {
  metadata {
    name      = "istory-prod-quota"
    namespace = kubernetes_namespace.istory_prod.metadata[0].name
  }

  spec {
    hard = {
      "requests.cpu"    = "8"
      "requests.memory" = "16Gi"
      "limits.cpu"      = "16"
      "limits.memory"   = "32Gi"
      "pods"           = "40"
    }
  }
}

# LimitRange for Prod Namespace
resource "kubernetes_limit_range" "istory_prod_limits" {
  metadata {
    name      = "istory-prod-limits"
    namespace = kubernetes_namespace.istory_prod.metadata[0].name
  }

  spec {
    limit {
      type = "Container"
      default = {
        cpu    = "1"
        memory = "1Gi"
      }
      default_request = {
        cpu    = "500m"
        memory = "512Mi"
      }
      max = {
        cpu    = "4"
        memory = "4Gi"
      }
      min = {
        cpu    = "100m"
        memory = "128Mi"
      }
    }
  }
} 
```
## 7-6. Variables.tf 생성
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

variable "eks_namespace_roles" {
  description = "Map of namespace names to IAM role configurations"
  type = map(object({
    name               = string
    environment        = string
    additional_policies = list(string)
  }))
  default = {
    "istory-dev" = {
      name               = "istory-dev"
      environment        = "development"
      additional_policies = []
    }
    "istory-prod" = {
      name               = "istory-prod"
      environment        = "production"
      additional_policies = []
    }
  }
}
```
## 7-8. Terraform 적용
```bash
terraform init
terraform plan
terraform apply
```
> 생성시 이미 리소스가 있다고 나오는 것은 AWS Console 화면에 접속해서 직접 삭제후 재수행 해주세요

## 7-9 kubeconfig 업데이트
```bash
## 컨텍스트 업데이트
aws eks update-kubeconfig --region ap-northeast-2 --name istory

## 확인
kubectl get no

====출력 예시====
NAME                                            STATUS   ROLES    AGE   VERSION
ip-10-1-3-86.ap-northeast-2.compute.internal    Ready    <none>   47m   v1.31.5-eks-5d632ec
ip-10-1-4-114.ap-northeast-2.compute.internal   Ready    <none>   47m   v1.31.5-eks-5d632ec

```

## 7-10 삭제
```bash
# 쿠버네티스 객체 삭제
kubectl delete all -n argocd
kubectl delete all -n istory-dev
kubectl delete all -n istory-prod

# terraform 삭제
terraform destroy
```
