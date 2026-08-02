# The Invisible Kingdom

A complete single-page field manual to microorganisms — bacteria, archaea,
viruses, fungi, protozoa and microalgae — covering structure, metabolism,
genetics, classification, disease and industrial use.

**[`index.html`](index.html)** is the whole site. One file, no build step, no
dependencies, no network requests. Open it in any browser.

## What's in it

| Part | Section | Covers |
| --- | --- | --- |
| I | Foundations | Scale, history of microbiology, microscopy and staining, classification and phylogeny, universal physiology, culture and sequencing methods |
| II | Bacteria | Morphology, the full cell envelope, endospores, metabolism, horizontal gene transfer, every major phylum, virulence factors, ~40 pathogens, industrial uses |
| III | Archaea | Discovery, ether lipids and pseudomurein, the three-domain comparison, all major groups, extremophily, methanogenesis, the human archaeome, biotech |
| IV | Viruses & acellular agents | Capsid architecture, all seven Baltimore classes, replication cycles, bacteriophages, ~40 human viral pathogens, antivirals and vaccine platforms, viroids and prions |
| V | Fungi & microfungi | Hyphae and dimorphism, reproduction, every phylum, fungal ecology, medical mycology, mycotoxins, antifungal drug classes, food and industry |
| VI | Protists | Supergroup framework, protozoan pathogens, the malaria life cycle, diatoms and dinoflagellates, harmful algal blooms, microscopic animals |
| VII | Microbes & the world | The human microbiome, infection and immunity, antimicrobials, antimicrobial resistance, sterilisation, food microbiology, biogeochemical cycles, extremophiles and astrobiology, frontiers |

## Features

- **Full-text search** across the whole manual (`/` or `Ctrl`/`Cmd`+`K`), with
  match highlighting and `Enter` / `Shift`+`Enter` to step through hits
- **Auto-generated contents rail** with scroll-spy, built from the headings
- **Light and dark themes** — follows the system preference, with a manual
  toggle that overrides it in both directions
- **Logarithmic scale diagram** placing prions through to the 1 cm
  *Thiomargarita magnifica* on one axis
- **Animated darkfield masthead** drawn on a canvas, disabled under
  `prefers-reduced-motion`
- Responsive down to phone widths, keyboard accessible, and print-styled

## Design

Palette taken from microbiological stain chemistry: crystal violet for
structure, safranin for warnings, malachite green and methylene blue for
secondary data. Set in Iowan Old Style / Palatino for reading with a system
grotesque for tables and labels. No webfonts are loaded, so the page renders
identically offline.

## A note on accuracy

This is a teaching reference, not a clinical one — nothing in it is medical
advice. Where a widely repeated claim is contested (the 10:1 microbe-to-human
cell ratio, "half your oxygen comes from the ocean", the wood-wide-web), the
text says so rather than repeating it. Renamed bacterial phyla are given
alongside their familiar older names, since both remain in use.
