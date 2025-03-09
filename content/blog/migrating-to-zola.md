+++
title = "Migrating from Hakyll to Zola"
date = 2025-03-09
author = "Mike McGirr"
[taxonomies]
tags = ["rust", "zola", "static-site"]
+++

I've recently migrated my personal website from [Hakyll](https://jaspervdj.be/hakyll/) (a Haskell static site generator) to [Zola](https://www.getzola.org/) (a Rust static site generator). Here's how it went.

## Why Zola?

After using Hakyll for several years, I wanted to try something new. Since I'm also interested in Rust, Zola seemed like a natural choice. Some benefits of Zola include:

- Single binary with no dependencies
- Extremely fast build times
- Built-in Sass compilation
- Simpler templating with Tera
- Great documentation

## Migration Process

The migration process involved several steps:

1. Setting up the Zola directory structure
2. Converting Hakyll templates to Tera templates
3. Moving content and adjusting front matter
4. Setting up Sass compilation
5. Configuring syntax highlighting

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
2. Add more content
3. Improve performance
4. Add more interactive features

Stay tuned for more updates!
