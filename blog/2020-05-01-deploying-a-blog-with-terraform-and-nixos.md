---
title: Deploying a blog to AWS with Terraform and NixOS
author: Mike McGirr
date: 2020-05-01
tags: [nixos, terraform, aws, hakyll, haskell] 
categories: Blog
---

## Introduction

My high level goal for this post is to cover how I've been using 
Terraform and NixOS together so far to deploy a basic personal webserver (as well as
some of the things I've learned over the course of doing this). 

I recently migrated my webserver over from Linode to a new hosting setup that
consists primarily of an AWS instance that's running NixOS. 
So now seemed like as good a time as ever to write a little about the setup I
ended up creating for this.

It's likely there are plenty of ways my setup could be improved,
and I'll probably be updating this post in the future or writing a follow up posts
as I update and improve my setup.

## Some background

**NOTE:** If you're already familiar with what NixOS and Terraform are, 
and just want to skip ahead to the meat of the blog, you can go to
["The Terraform Pieces"](#the-terraform-pieces) section and proceed on from there.

### NixOS

For anyone reading this I'll assume a minor level of familiarity with using
NixOS (or at least budding enthusiasm to try to learn how to use Nix and NixOS!).
For those not familiar, it's worth mentioning first that
[NixOS](https://nixos.org/nixos/) is a distribution of Linux that uses the Nix package manager.

NixOS takes a different approach from most mainstream Linux distributions in how 
it manages and configures itself and the software running on it.
I'm not going to use this post as a general introduction to using NixOS though,
and there are many good explanations and tutorials about it out there.
What I will focus on here are the relevant Nix and NixOS pieces that I'm using 
here for the webserver. 

For my purposes I'm using NixOS because it's a useful tool for automating software
deployments and configurations (and doing so in a pure and reproducible way). 
So beyond just personal preference for choosing it as the OS on the instances, 
NixOS is also a practical devops tool for managing and maintaining the webserver 
itself.

### Terraform

I'm using Terraform at the moment simply because I'm quite familiar with using 
that to create and manage AWS resources. I'll assume the reader is somewhat 
familiar with what Terraform is and some of the basics for using it 
(but it's okay if you're not!). 

[Terraform](https://www.terraform.io/) is a great tool for defining the 
infrastructure in code and deploying it. 
It's similar to NixOS in that it doesn't just _create_ the infrastructure, 
but it also manages maintaining it and removing resources that you remove from your code 
(similar to how NixOS will create an OS environment that matches the setup you declare
in your NixOS configuration).

### NixOps

There are plenty of ways to create and manage cloud resources. At some point
in the near future I'll probably migrate the webserver in the post over to a setup 
created and managed by [NixOps](https://nixos.org/nixops) (and write up a post
about doing that). 

I do recommend checking out [NixOps](https://github.com/NixOS/nixops) though and a
colleague of mine has 
[a very excellent NixOps tutorial](https://github.com/nh2/nixops-tutorial) for 
getting started with using NixOps that I highly recommend checking out.

So why not NixOps for this setup? Well like I mentioned before, at this point 
I'm more familiar with Terraform and I've been curious about how using Terraform 
and NixOS would work and look together in practice. If and when I do switch this
webserver over to NixOps I'll definitely want to write up a post comparing that
experience to using Terraform.

_Now to the project itself_

## The Terraform pieces

The Terraform can be described as consisting of three main pieces: 

1. There is [a general Terraform module](https://github.com/mcgirr/terraform-nixos-nginx-webserver/tree/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper) 
   that's being used to create the resources. 
   Most of the "action" and interesting bits for creating the resources happens in 
   this module. The module is also general enough that it _should_ be able to be
   used by more than one project (not just for my particular webserver). 
2. The other piece is [the project itself](https://github.com/mcgirr/terraform-nixos-nginx-webserver/tree/3cc2180a37d6639580cec7ad5c176198e203ea07/mikemcgirr-com-webserver-aws-env). This uses the aforementioned
   Terraform module. The project is where the specific values are set and 
   where we instantiate the Terraform module that creates the resources. 
3. The last item is [a very small self-contained Terraform project](https://github.com/mcgirr/terraform-nixos-nginx-webserver/tree/3cc2180a37d6639580cec7ad5c176198e203ea07/aws-dns)
   for creating the DNS zone (I'll explain why I kept this as a separate project). 

### A Terraform module for the webserver

A good practice with Terraform projects is to separate out the parts that 
can be reused for other projects from the pieces that a more specific to 
one particular project. In this case the parts that can be re-used for this 
project are located in the module code in a wrapper
module at:

[`modules/terraform-aws-nixos-webserver-wrapper`](https://github.com/mcgirr/terraform-nixos-nginx-webserver/tree/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper)

This module contains Terraform resources (and instantiates other publicly available modules)
required to create the AWS infrastructure that will host the website. 

In this module (for example) we have:

- The [AWS Route53 records](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper/route53.tf#L8-L15)
  for the website:

  ```terraform
  resource "aws_route53_record" "www" {
    zone_id = data.aws_route53_zone.primary.zone_id
    name    = "www.${var.base_domain}."
    type    = "A"
    ttl     = "300"
    records = [ aws_eip.web_server.public_ip ]
  }
  ```

- The necessary [ports in the security groups](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper/webserver-sg.tf#L46-L57)
  are opened up for the webserver to be able to work: 

  ```terraform
  module "web-server-https-rule" {
    # Commented out because these change are not yet in the upstream module
    # source  = "fpco/foundation/aws//modules/single-port-sg"
    # version = "0.9.4"
    source  = "git::ssh://git@github.com/fpco/terraform-aws-foundation//modules/single-port-sg?ref=312-vpc-and-subnets-IPv6-support"

    description       = "Allow HTTPS access on port 443"
    port              = 443
    cidr_blocks       = ["0.0.0.0/0"]
    ipv6_cidr_blocks  = ["::/0" ]
    security_group_id = module.web-server-sg.id
  }
  ```

- We create an IPv6 enabled
  [VPC](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper/ec2.tf#L1-L16):
 
  ```terraform
  module "vpc" {
    # source  = "fpco/foundation/aws//modules/vpc"
    # version = "0.9.4"
    source    = "git::ssh://git@github.com/fpco/terraform-aws-foundation//modules/vpc?ref=312-vpc-and-subnets-IPv6-support"

    name_prefix          = var.name_prefix
    region               = var.region
    cidr                 = var.vpc_cidr
    extra_tags           = merge(var.extra_tags, var.vpc_extra_tags)
    enable_dns_hostnames = var.enable_dns_hostnames
    enable_dns_support   = var.enable_dns_support
    dns_servers          = var.dns_servers

    assign_generated_ipv6_cidr_block = "true"
  }
  ``` 
 
- An IPv6 capable [subnet](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper/ec2.tf#L18-L31):

  ```terraform
  module "public-subnet" {
    # source  = "fpco/foundation/aws//modules/subnets"
    # version = "0.9.4"
    source    = "git::ssh://git@github.com/fpco/terraform-aws-foundation//modules/subnet-ipv6?ref=312-vpc-and-subnets-IPv6-support"

    az          = var.az
    vpc_id      = module.vpc.vpc_id
    name_prefix = "${var.name_prefix}-public-subnet"
    cidr_block = var.public_subnet_cidr
    extra_tags  = merge(var.extra_tags, var.public_subnet_extra_tags)

    vpc_ipv6_cidr_block = module.vpc.ipv6_cidr_block
  }
  ```

- And the [AWS instance itself](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper/ec2.tf#L52-L88):
  
  ```terraform
  resource "aws_instance" "web_server" {
    ami                     = var.web_server_ami
    instance_type           = var.web_server_type
    key_name                = aws_key_pair.web_server_ssh_key.key_name
    vpc_security_group_ids  = [module.web-server-sg.id]
    subnet_id               = module.public-subnet.id

    ipv6_address_count      = 1

    iam_instance_profile    = module.iam-web-server-instance-profile.iam_profile_id

    disable_api_termination = var.ec2_termination_protection
    # set based on need - false for dev true for prod

    # Nixos seems to only have user_data go to the configuration.nix location
    user_data = ""

    root_block_device {
      volume_size = 20  # plenty for now
      delete_on_termination = true

      encrypted  = true
      kms_key_id = aws_kms_key.root.arn
    }

    tags = {
      Name      = "${var.name_prefix}-web-server"
      Terraform = true
    }
  }
  ``` 
  
But again, none of these resources are _truly_ specific to this particular
webserver or the eventual website/blog that will go on it. 

### The Terraform project

That leads in to the portions that **are** project specific. When we actually 
want to use the module that we've defined we need to instantiate it in a project.

So for this webserver, we instantiate the `terraform-aws-nixos-webserver-wrapper`
module in the [mikemcgirr-com-webserver-aws-env](https://github.com/mcgirr/terraform-nixos-nginx-webserver/tree/3cc2180a37d6639580cec7ad5c176198e203ea07/mikemcgirr-com-webserver-aws-env)
directory as a project.
And by that I mean this directory _is_ the Terraform project (in the same way that
the [terraform-aws-nixos-webserver-wrapper](https://github.com/mcgirr/terraform-nixos-nginx-webserver/tree/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper) 
directory _is_ the `terraform-aws-nixos-webserver-wrapper` module).

In order to instantiate the module we [source the module using a relative link](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/mikemcgirr-com-webserver-aws-env/main.tf#L6-L37)
in the `main.tf` file in `mikemcgirr-com-webserver-aws-env` and provide the
arguments that the module requires as inputs (at a minimum these are any variables in the
[variables file](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper/variables.tf)
in the module that do not have default values).

```terraform
module "mikemcgirr-com-server" {
  source = "../modules/terraform-aws-nixos-webserver-wrapper"

  name_prefix = local.name_prefix
  base_domain = local.base_domain
  hostname    = local.hostname

  content_location = local.content_location

  region = local.region

  email = var.email

  vpc_cidr           = local.vpc_cidr
  public_subnet_cidr = local.public_subnet_cidr

  # If true, enables EC2 Instance Termination Protection
  ec2_termination_protection = local.web_server_termination_protection

  web_server_type = local.web_server_type
  web_server_ami  = local.web_server_ami

  ssh_pubkey = local.ssh_pubkey

  # DNS
  enable_dns_hostnames = local.enable_dns_hostnames
  enable_dns_support   = local.enable_dns_support
  dns_servers          = local.dns_servers

  # AZ
  az = local.az
}
```

Notice that in the `main.tf` file we're referring to `local` variables 
for each of the variables we provide as inputs to the module. These are the
specific values that we'd like to use for this project. The local values are set in the
[locals.tf](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/mikemcgirr-com-webserver-aws-env/locals.tf#L1-L32) 
file in the project:

```terraform
locals {
  name_prefix = "mikemcgirr"
  base_domain = "${local.name_prefix}.com"
  hostname    = "mikemcgirr"

  content_location = "mikemcgirr-com"
  # Used to set things like /var/www/${content_location}/_site as the root of the site

  region      = "us-west-2"

  vpc_cidr = "10.0.0.0/16"
  public_subnet_cidr = cidrsubnet(local.vpc_cidr, 8, 15)

  # webserver EC2
  web_server_termination_protection = "false"
  # If true, enables EC2 Instance Termination Protection

  web_server_type = "t3a.medium"
  web_server_ami  = "ami-02d9a19f77b47882a"
  # This is using the official NixOS AMI in us-west-2 for NixOS 19.09
  # See https://nixos.org/nixos/download.html

  ssh_pubkey = "./id_rsa.pub"

  # DNS
  enable_dns_hostnames = "true"
  enable_dns_support   = "true"
  dns_servers          = ["AmazonProvidedDNS"]

  # AZ
  az      = data.aws_availability_zones.available.names[0]
}
```

We can pin [things like the NixOS AMI](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/mikemcgirr-com-webserver-aws-env/locals.tf#L19)
that we're going to be using on the eventual instance in the `locals.tf` file. 

In a later section I'll cover actually using and deploying this project
to build some resources but there is one more piece of Terraform code that we
need to go over.

### A small separate Terraform project for the AWS DNS

The DNS zone Terraform project is separate because it's largely independent from the
webserver itself (and we can use a [data source](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper/route53.tf#L2-L4)
to look it up from where the DNS is handled in the web server module). 
Also it's _reasonably_ likely that for this scope of project, the zone or the 
nameserver record will not need to change much.

This setup is handy mainly if you use a registrar _other_ than AWS Route53. 
I've found this method  of setting up your DNS (creating the zone in one project
and using a datasource to look it up in others) to be a nice way to handle using 
Route53 for DNS while using a separate registrar.

So in this case to do that I need to apply 
[the code](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/aws-dns/route53.tf#L1-L18)
in the DNS project and it will output the Route53 nameservers for me to the CLI 
(because that is [set as an output](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/aws-dns/route53.tf#L15-L18) in the DNS Terraform
project):

```terraform
locals {
  mikemcgirr_dns_zone_name = "mikemcgirr.com"
  region = "us-west-2"
}

provider "aws" {
  version = "~> 2.18"
  region  = local.region
}

resource "aws_route53_zone" "mikemcgirr" {
  name = local.mikemcgirr_dns_zone_name
}

output "mikemcgirr_ns_records" {
  value       = aws_route53_zone.mikemcgirr.name_servers
  description = "The name server records for the mikemcgirr.com DNS zone."
}
```

Then I just need to copy these nameserver output values over _once_ to my registrar
as for the "external nameserver". After that I can use Route53
to manage the DNS records, which means I can set and manipulate DNS records quite
easily in my project code using the official AWS Terraform provider's
[resources for Route53 DNS records](https://www.terraform.io/docs/providers/aws/r/route53_record.html).

**NOTE:** One last, related, reason I didn't want the Terraform code that creates the zone and 
the nameserver values to be in the same Terraform module as the webserver itself
is: I would have to be _much_ more careful if I wanted to destroy all
the resources created for just the webserver while leaving the zone
file intact. I realize you can do this with a targeted destroy, and I could setup a 
Makefile rule to make that easy, but really with this setup I didn't want
to have to worry about that being a possibility and there wasn't much benefit to
having it in one project. 

So with the current setup now, if I wanted to, I could
destroy _all_ the resources created by Terraform for just the webserver and not
have to worry that I removed the DNS zone (which would mean I would need to update the
nameservers I set for the domain with my external registrar).

## The NixOS pieces

I'm using a single file on the instance at `/etc/nixos/configuration.nix` to 
specify the configuration of the system. 

I'll cover the basic approach I'm using to copy this over to the 
instance applying it in a later section (it's nothing fancy compared to NixOps). 
For now though I'd like go over a few pieces of it, what they do, and also how I'm
generating the file from the Terraform project locally before I copy it over.

To start, the file that is created looks like the following in its
entirety:

```nix
{ config, pkgs, ... }:
{
  imports = [
    <nixpkgs/nixos/modules/virtualisation/amazon-image.nix>
  ];

  ec2.hvm = true;

  networking = {
    hostName = "mikemcgirr";

    enableIPv6 = true; 

    # Open ports in the firewall.
    firewall.allowedTCPPorts = [
       22
       80
       443
    ];
  };

  environment = {
    systemPackages = with pkgs; [
        htop
        vim
    ];
  };

  services.nginx = {
    enable = true;
    virtualHosts = {

      "www.mikemcgirr.com" = {
        forceSSL = true;

        enableACME = true;

        locations."/" = {
          root = "/var/www/mikemcgirr-com/_site";
        };


      };

      "mikemcgirr.com" = {
        forceSSL = true;

        enableACME = true;

        locations."/" = {
          root = "/var/www/mikemcgirr-com/_site";
        };

      };

    };
  };

  # Configure the email address used with Let's Encrypt.
  # This way you get renewal reminders (automated by NixOS) as well as expiration emails.
  security.acme.certs."www.mikemcgirr.com" = {
    email = "mike@oatsmail.com";

    extraDomains = { "mikemcgirr.com" = null; };
  };

  system.stateVersion = "19.09";
}
```

Since I'm using the NixOS AMI I'm importing: 

`<nixpkgs/nixos/modules/virtualisation/amazon-image.nix>`

This import sets a lot of the defaults we'd like to use on an AWS instance so 
it's helpful to include. If you use the official NixOS AMI this import comes
set in the intitial `/etc/nixos/configuration.nix` file on that by default. 
And if you'd like to explore more about what this file is composed of and what 
it does you can find the source for it at:
[github.com/NixOS/nixpkgs/blob/master/nixos/modules/virtualisation/amazon-image.nix](https://github.com/NixOS/nixpkgs/blob/master/nixos/modules/virtualisation/amazon-image.nix)

Next `ec2.hvm = true;` is set because if you're using an ec2
instance based on the HVM virtualization type, which I am in this project,
GRUB will pick up changes to the configuration across reboots.

The line `hostName = "mikemcgirr";` is unremarkable (it just sets the hostname
of the instance) except that it's being set using a Terraform template var. 
If you check out the template file at
[`modules/terraform-aws-nixos-webserver-wrapper/templates/configuration.nix.tpl`](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper/templates/configuration.nix.tpl#L10) 
you can see that this line is being set with a Terraform variable: `hostName = "${hostname}";`
and this is being fed into the template file from 
[the `local_file` resource](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper/configuration.tf#L6)
being used to create it:

```terraform
resource "local_file" "nix_configuration" {
  content = templatefile("${path.module}/templates/configuration.nix.tpl", {
    domain            = var.base_domain
    email             = var.email
    hostname          = var.hostname
    content_location  = var.content_location
  })
  filename = "${path.root}/configuration.nix"
  file_permission = "0600"
}
```

The `configuration.nix` file you see above
was generated by the template file and that `local_file` resource.

Another thing being set in the configuration file are settings for which ports to open 
for the webserver. We need to open port 80 even though we're 
forcing SSL with the line `forceSSL = true;` because Let's Encrypt needs port 80
for the ACME challenge path.

```nix
firewall.allowedTCPPorts = [
   22
   80
   443
];
```

The option:
`services.nginx.virtualHosts."www.mikemcgirr.com".locations."/".root`
sets the root `/` location of `www.mikemcgirr.com` for the nginx virtual host
(this is set to where I'll eventually put the static content for my blog on the instance).

And that's it really. You don't need much more than that to get a NGINX 
server running on a NixOS based server that supports IPv6 and Let's Encrypt certs! 

**NOTE:** And the best part of using NixOS to do this is each configuration creates its
own environment and I can easily roll back to an earlier version of the state 
of the server if I change my config and something ends up being an issue.

## Running the Terraform build and the initial infrastructure pieces

Applying the Terraform project at this point is actually pretty simple. 
From the project use the Makefile `init`, `plan`, and `apply` rules. 

So with my webserver project in `terraform-nixos-nginx-webserver/mikemcgirr-com-webserver-aws-env`
I'd run the following:

```shell
make init plan apply
```

## Applying the NixOS configuration on the instance and copying over the website content 

Next we need to use the `configuration.nix` file we generated from the `apply`. 

To make this a little easier, I've created an `init.sh` file. This will be
be generated from a template 
([modules/terraform-aws-nixos-webserver-wrapper/templates/init.sh.tpl](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper/templates/init.sh.tpl)) 
much like we did in order to create the `configuration.nix` file. 

The resulting `init.sh` file is then placed in the project directory (`terraform-nixos-nginx-webserver/mikemcgirr-com-webserver-aws-env`), 
so then all I have to do is run `./init.sh` and this will:

1. Copy over the `configuration.nix` file to the correct location on the server. 
2. Copy the initial static blog files (these are assumed
   to be up two directories from the Terraform project but you will want to edit 
   [this line](https://github.com/mcgirr/terraform-nixos-nginx-webserver/blob/3cc2180a37d6639580cec7ad5c176198e203ea07/modules/terraform-aws-nixos-webserver-wrapper/templates/init.sh.tpl#L11) 
   to point at where ever your initial static blog files are locally).
3. Apply the `configuration.nix` file on the server which will setup and start the NGINX server.

And then that's all there is to it! You're off to the races! 

## _Conclusion_

This post was in part to show how you could use tools from fairly disparate areas 
of DevOps (Terraform and NixOS) together in a way that turns out to be pretty handy.

The setup in this post is able to benefit from the wide range of Terraform resources
available for AWS, while at the same time using NixOS to configure the instance. 
While I likely will soon in the future, for now I didn't need to switch over to
NixOps in order to benefit from the advantages that running NixOS on my instance brings
(for some DevOps teams: having to switch over to NixOps might be a deal-breaker - or at least not trivial 
if they have existing, non-NixOS, legacy infrastructure they need to support).

The setup in this post is also handy because Terraform has been widely adopted in DevOps
and enjoys near universal support for cloud providers (with numerous people 
assisting to keep the providers up-to-date with the latest cloud resource 
infrastructure offerings). So there _may_ be cases where certain cloud resources are 
**not** supported by NixOps but **are** supported by Terraform and that's where 
this setup would be handy (although with API changes in NixOps this may not be _as_ big of
a problem in the future).

### Next steps

- I have a slightly more complex setup (similar to the one in this post) that uses Terraform
  and NixOS to create the AWS resources for an email server 
  that uses [https://gitlab.com/simple-nixos-mailserver/nixos-mailserver](https://gitlab.com/simple-nixos-mailserver/nixos-mailserver)
  which I'd like to write up a post about at some point down the line.

- Also, like I mentioned earlier in this post, it's very likely I'll be testing out
  switching this blog to [NixOps](https://nixos.org/nixops) at some point in the near
  future. 
  If so I'll write a follow-up post about how that compares to the setup in this post 
  and what the experience is like using NixOps.
