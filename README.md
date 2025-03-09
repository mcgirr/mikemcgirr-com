# mikemcgirr-com

The code for my personal website and blog.

## General details

- This site uses [Zola](https://www.getzola.org/), a blazing fast static site generator built in Rust.
- In addition to that it also uses [Bootstrap v4](https://getbootstrap.com/docs/4.0/getting-started/introduction/) for some of the styling.
- The fonts used are open source and listed in the site's legal section.

## Build requirements

Mainly:

- [Nix](https://nixos.org/nix/)
- [Zola](https://www.getzola.org/) (installed via Nix)
- [direnv](https://direnv.net/) (optional, for automatic environment loading)

## Development

### Using Nix

This project uses Nix for reproducible development environments:

```bash
# Enter development environment
nix-shell

# Or if using direnv (recommended)
direnv allow
```

### Building the site

```bash
# Development server with live reloading
make server

# Build the site
make build

# Clean the public directory
make clean

# Rebuild from scratch
make rebuild
```

### Deployment

Customize the `make deploy` command in the Makefile to deploy the site according to your needs.
