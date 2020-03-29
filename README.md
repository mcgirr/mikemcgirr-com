# mikemcgirr-com

The code for my personal website and blog.

## General details

- This uses [Hakyll](https://jaspervdj.be/hakyll/) which is an excellent Haskell library for generating static sites.
  You can find the code for that on Github [here](https://github.com/jaspervdj/hakyll)
  and helpful docs for that [here](https://jaspervdj.be/hakyll/tutorials.html).
- In addition to that it also uses [Bootstrap v4](https://getbootstrap.com/docs/4.3/getting-started/introduction/) for some of the styling.
- And the fonts I used are open source and listed in the blog's legal section.
- If you're curious about setting up somthing similar check out the [Makefile](./Makefile).

## Build requirements

Mainly:

- [Nix](https://nixos.org/nix/)
- [Stack](https://docs.haskellstack.org/en/stable/README/)

## Blog TODO list

- Add better integration with latest Haskell tooling like ghcide or lsp compatible tools (RIP intero)
- A better nix shell setup
- Other TODO items in the Makefile and elsewhere 
- Setup blog analytics and maybe a little SEO (although that's a lot of snake oil work).
