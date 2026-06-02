output "cluster_name" {
  value = aws_ecs_cluster.omni.name
}

output "vpc_id" {
  value = aws_vpc.omni.id
}

output "db_password_secret" {
  value     = random_password.db_password.result
  sensitive = true
}
