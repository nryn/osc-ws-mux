# the instance itself

module "ec2_instance" {
  source  = "terraform-aws-modules/ec2-instance/aws"
  version = "~> 3.0"

  name = "osc-ws-mux-instance"

  ami                    = "ami-0dbec48abfe298cab" // Amazon Linux 2 AMI (HVM), SSD Volume Type
  instance_type          = "t3.micro"
  key_name               = aws_key_pair.access.key_name
  monitoring             = false
  vpc_security_group_ids = [aws_security_group.allow_osc.id]
  subnet_id              = aws_subnet.public.id

  # provision the ec2
  user_data = data.cloudinit_config.provisioner.rendered

  tags = {
    Terraform = "true"
  }
}

# stuff needed for provisioning

locals {
  cloud_config_config = <<-END
    #cloud-config
    ${jsonencode({
  write_files = [
    {
      path        = "/osc-ws-mux/broadcasterClass.js"
      permissions = "0644"
      owner       = "root:root"
      encoding    = "b64"
      content     = filebase64("../broadcasterClass.js")
    },
    {
      path        = "/osc-ws-mux/index.js"
      permissions = "0644"
      owner       = "root:root"
      encoding    = "b64"
      content     = filebase64("../index.js")
    },
    {
      path        = "/osc-ws-mux/receiver.js"
      permissions = "0644"
      owner       = "root:root"
      encoding    = "b64"
      content     = filebase64("../receiver.js")
    },
    {
      path        = "/osc-ws-mux/package.json"
      permissions = "0644"
      owner       = "root:root"
      encoding    = "b64"
      content     = filebase64("../package.json")
    },
    {
      path        = "/osc-ws-mux/web/index.html"
      permissions = "0644"
      owner       = "root:root"
      encoding    = "b64"
      content     = filebase64("../web/admin.html")
    },
  ]
})}
  END
}

data "template_file" "user_data" {
  template = file("./files/provisioner.sh")
}

data "cloudinit_config" "provisioner" {
  gzip          = false
  base64_encode = false

  part {
    content_type = "text/cloud-config"
    filename     = "cloud-config.yaml"
    content      = local.cloud_config_config
  }

  part {
    content_type = "text/x-shellscript"
    filename     = "provisioner.sh"
    content      = data.template_file.user_data.rendered
  }
}

# ssh key

variable "public_key" {
  description = "the public key to use for access to the AWS EC2 instance"
}

resource "aws_key_pair" "access" {
  key_name   = "osc-ws-mux-instance-access-key"
  public_key = var.public_key
}
