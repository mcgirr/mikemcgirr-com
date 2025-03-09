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
