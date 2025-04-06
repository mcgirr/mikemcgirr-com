+++
title = "Migrating from Hakyll to Zola"
date = 2025-03-09
author = "Mike McGirr"
[taxonomies]
tags = ["rust", "zola", "static-site"]
+++

I've recently migrated this website from [Hakyll](https://jaspervdj.be/hakyll/) (a Haskell static site generator)
over to [Zola](https://www.getzola.org/) (a Rust based static site generator).

## Why Zola?

After using Hakyll for several years, I wanted to try something new.

Some benefits of I found with Zola were:

- Single binary with no dependencies
- Extremely fast build times
- Built-in Sass compilation
- Simpler templating with Tera
- Great documentation!

## Development Environment

One of the key improvements in my workflow has been setting up a reproducible
development environment using Nix and direnv for the site.

#### Nix Shell

I'm using a `shell.nix` configuration to create a consistent development environment:

```
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Rust development
    rustc
    cargo
    rustfmt
    clippy
    rust-analyzer

    # Zola
    zola

    # Other tools
    git
    direnv
  ];

  # Environment variables
  shellHook = ''
    echo "Rust development environment loaded!"
    echo "Zola version: $(zola --version)"
  '';
}
```

This approach ensures that when I work on this project on different machines, each
gets an identical set of the needed dependencies and tools.
It also helps for when I want to pick back up on the project at a later time.

There's more I could be doing to pin the _exact_ dependencies, but it's a good start
and makes the build process more reproducible and reliable in general.

### `direnv` Integration

I've also added a simple `.envrc` file containing just `use nix` which automatically
activates the Nix environment when I enter the project directory. This means:

- No manual activation of environments necessary
- Project-specific tools are automatically available
- Switching between different projects on my machines with different requirements is seamless
- Environment variables are consistently set

I've found that this combination of Nix and direnv creates a (relatively) frictionless
development experience that makes working on the site much more pleasant.

## Migration Process

The migration was pretty simple but involved several steps:

1. Setting up the Zola directory structure
2. Converting Hakyll templates to Tera templates
3. Moving content
4. Setting up Sass compilation

```rust
// Sample Rust code to demonstrate syntax highlighting
fn main() {
    println!("Hello from Zola!");

    let numbers = vec![1, 2, 3, 4, 5];
    let sum: i32 = numbers.iter().sum();

    println!("Sum: {}", sum);
}
```

## Next Steps

Now that the migration is complete, I plan to:

1. Update the design
   - Move from Bootstrap to Tailwind CSS for more flexibility and better performance
   - Create a more modern, responsive layout
2. Leverage Zola's built-in features
   - Take advantage of Zola's native syntax highlighting instead of highlight.js
3. Improve performance and my overall nginx server setup
4. Add more content

I'm particularly excited about switching to Tailwind, as it should give me more
granular control over the design compared to Bootstrap.
