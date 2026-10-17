import hljs from 'highlight.js/lib/common';
import clojure from 'highlight.js/lib/languages/clojure';
import cmake from 'highlight.js/lib/languages/cmake';
import coffeescript from 'highlight.js/lib/languages/coffeescript';
import crystal from 'highlight.js/lib/languages/crystal';
import d from 'highlight.js/lib/languages/d';
import dart from 'highlight.js/lib/languages/dart';
import delphi from 'highlight.js/lib/languages/delphi';
import django from 'highlight.js/lib/languages/django';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import elixir from 'highlight.js/lib/languages/elixir';
import elm from 'highlight.js/lib/languages/elm';
import erlang from 'highlight.js/lib/languages/erlang';
import fortran from 'highlight.js/lib/languages/fortran';
import fsharp from 'highlight.js/lib/languages/fsharp';
import gherkin from 'highlight.js/lib/languages/gherkin';
import groovy from 'highlight.js/lib/languages/groovy';
import haskell from 'highlight.js/lib/languages/haskell';
import http from 'highlight.js/lib/languages/http';
import julia from 'highlight.js/lib/languages/julia';
import latex from 'highlight.js/lib/languages/latex';
import lisp from 'highlight.js/lib/languages/lisp';
import matlab from 'highlight.js/lib/languages/matlab';
import nginx from 'highlight.js/lib/languages/nginx';
import ocaml from 'highlight.js/lib/languages/ocaml';
import powershell from 'highlight.js/lib/languages/powershell';
import properties from 'highlight.js/lib/languages/properties';
import protobuf from 'highlight.js/lib/languages/protobuf';
import puppet from 'highlight.js/lib/languages/puppet';
import scala from 'highlight.js/lib/languages/scala';
import scheme from 'highlight.js/lib/languages/scheme';
import stylus from 'highlight.js/lib/languages/stylus';
import tcl from 'highlight.js/lib/languages/tcl';
import vbscript from 'highlight.js/lib/languages/vbscript';
import verilog from 'highlight.js/lib/languages/verilog';
import vhdl from 'highlight.js/lib/languages/vhdl';

/**
 * highlight.js for the preview: the 36 `common` languages plus the ones the
 * code editor learned in code-languages.ts, so a fence the editor colours is
 * coloured in the preview too.
 */
const EXTRA_LANGUAGES = {
  clojure, cmake, coffeescript, crystal, d, dart, delphi, django, dockerfile, elixir,
  elm, erlang, fortran, fsharp, gherkin, groovy, haskell, http, julia, latex, lisp,
  matlab, nginx, ocaml, powershell, properties, protobuf, puppet, scala, scheme,
  stylus, tcl, vbscript, verilog, vhdl,
};

/** Fence names the editor accepts that highlight.js spells differently. */
const EXTRA_ALIASES: Record<string, string[]> = {
  xml: ['vue', 'svelte'],
  scss: ['sass'],
  django: ['jinja2'],
  ini: ['cfg'],
  lisp: ['commonlisp'],
  delphi: ['pascal'],
  verilog: ['systemverilog'],
  wasm: ['wat', 'wast'],
  kotlin: ['kts'],
  objectivec: ['objective-c'],
  groovy: ['gradle'],
  julia: ['jl'],
  matlab: ['octave'],
};

for (const [name, grammar] of Object.entries(EXTRA_LANGUAGES)) hljs.registerLanguage(name, grammar);
for (const [languageName, aliases] of Object.entries(EXTRA_ALIASES)) hljs.registerAliases(aliases, { languageName });

export default hljs;
