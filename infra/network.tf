data "aws_availability_zones" "available" {
  state = "available"
}

variable "az_count" {
  default = 1
}

resource "aws_vpc" "osc_ws_mux" {
  cidr_block           = "172.17.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "osc-ws-mux-VPC"
  }
}

# Create var.az_count public subnets, each in a different AZ
resource "aws_subnet" "public" {
  cidr_block              = cidrsubnet(aws_vpc.osc_ws_mux.cidr_block, 8, var.az_count)
  availability_zone       = data.aws_availability_zones.available.names[0]
  vpc_id                  = aws_vpc.osc_ws_mux.id
  map_public_ip_on_launch = true

  tags = {
    Name = "osc-ws-mux-public"
  }
}

# Internet Gateway for the public subnet
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.osc_ws_mux.id

  tags = {
    Name = "osc-ws-mux-IGW"
  }
}

# Route the public subnet traffic through the IGW
resource "aws_route" "internet_access" {
  route_table_id         = aws_vpc.osc_ws_mux.main_route_table_id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.igw.id
}

resource "aws_security_group" "allow_osc" {
  name        = "allow_osc"
  description = "Allow UDP and TLS inbound traffic"
  vpc_id      = aws_vpc.osc_ws_mux.id

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

  ingress {
    description = "Allow Websocket"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow UDP"
    from_port   = 57121
    to_port     = 57121
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow TLS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description      = "allow all out"
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Name = "allow_udp_and_tls"
  }
}

