terraform {
  backend "s3" {
    bucket = "omni-grid-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "us-east-1"
}

variable "environment" {
  default = "production"
}

# ── VPC ──
resource "aws_vpc" "omni" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = {
    Name = "omni-grid-${var.environment}"
  }
}

resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.omni.id
  cidr_block        = "10.0.${count.index}.0/24"
  availability_zone = "${var.aws_region}${count.index == 0 ? "a" : "b"}"
  map_public_ip_on_launch = true
}

# ── ECS Fargate ──
resource "aws_ecs_cluster" "omni" {
  name = "omni-grid-${var.environment}"
}

resource "aws_ecs_task_definition" "pde_engine" {
  family                   = "pde-engine"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "2048"
  memory                   = "8192"
  execution_role_arn       = aws_iam_role.ecs_exec.arn
  container_definitions = jsonencode([
    {
      name      = "pde-engine"
      image     = "ghcr.io/omni-grid/pde-engine:latest"
      essential = true
      portMappings = [
        { containerPort = 50051, protocol = "tcp" },
        { containerPort = 8001,  protocol = "tcp" },
      ]
      environment = [
        { name = "DB_HOST",  value = aws_rds_cluster.timescaledb.endpoint },
        { name = "NATS_URL", value = "nats://${aws_mq_broker.nats.endpoint}:4222" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/omni-grid/pde-engine"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "pde"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "pde_engine" {
  name            = "pde-engine"
  cluster         = aws_ecs_cluster.omni.id
  task_definition = aws_ecs_task_definition.pde_engine.arn
  desired_count   = 2
  launch_type     = "FARGATE"
  network_configuration {
    subnets         = aws_subnet.public[*].id
    assign_public_ip = true
    security_groups = [aws_security_group.omni_svc.id]
  }
}

# ── RDS TimescaleDB ──
resource "aws_rds_cluster" "timescaledb" {
  cluster_identifier = "omni-grid-${var.environment}-tsdb"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  database_name      = "omnigrid"
  master_username    = "omni_admin"
  master_password    = random_password.db_password.result
  vpc_security_group_ids = [aws_security_group.omni_db.id]
  db_subnet_group_name   = aws_db_subnet_group.omni.name
  skip_final_snapshot    = var.environment != "production"
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "omni" {
  name       = "omni-grid-${var.environment}"
  subnet_ids = aws_subnet.public[*].id
}

# ── NATS (Message Broker) ──
resource "aws_mq_broker" "nats" {
  broker_name        = "omni-grid-${var.environment}-nats"
  engine_type        = "NATS"
  engine_version     = "2.10"
  host_instance_type = "mq.t3.micro"
  publicly_accessible = true
  users {
    username = "omni_nats"
    password = random_password.nats_password.result
  }
  subnet_ids         = aws_subnet.public[*].id
  security_groups    = [aws_security_group.omni_svc.id]
}

resource "random_password" "nats_password" {
  length  = 24
  special = false
}

# ── Security Groups ──
resource "aws_security_group" "omni_svc" {
  name        = "omni-grid-${var.environment}-svc"
  description = "Omni-Grid service security group"
  vpc_id      = aws_vpc.omni.id

  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "omni_db" {
  name        = "omni-grid-${var.environment}-db"
  description = "Database security group"
  vpc_id      = aws_vpc.omni.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.omni_svc.id]
  }
}

# ── IAM ──
resource "aws_iam_role" "ecs_exec" {
  name = "omni-grid-${var.environment}-ecs-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_exec_policy" {
  role       = aws_iam_role.ecs_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ── CloudWatch ──
resource "aws_cloudwatch_log_group" "pde_engine" {
  name              = "/ecs/omni-grid/pde-engine"
  retention_in_days = 30
}

# ── Outputs ──
output "nats_endpoint" {
  value = aws_mq_broker.nats.endpoint
}

output "db_endpoint" {
  value = aws_rds_cluster.timescaledb.endpoint
}
