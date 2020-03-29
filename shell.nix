{ pkgs ? import <nixpkgs> {}, ghc ? pkgs.ghc }:

# TODO pin to a package release tar
# add something like this
# with import (fetchTarball https://github.com/NixOS/nixpkgs/archive/18.03.tar.gz) {};
# let ghc = haskell.compiler.ghc802;
# in

# TODO I should probably either have hakyll installed in the nix shell or make
# this happen with Stack in the nix shell

pkgs.haskell.lib.buildStackProject {
  name = "mikemcgirr.com";
  inherit ghc;
  buildInputs = with pkgs; [ zlib unzip ];
  LANG = "en_US.UTF-8";
  TMPDIR = "/tmp";
}
