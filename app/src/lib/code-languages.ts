import { LanguageDescription, LanguageSupport, StreamLanguage, type StreamParser } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { html as htmlLang } from '@codemirror/lang-html';
import { css as cssLang } from '@codemirror/lang-css';
import { json as jsonLang } from '@codemirror/lang-json';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { go } from '@codemirror/lang-go';
import { yaml } from '@codemirror/lang-yaml';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { shell } from '@codemirror/legacy-modes/mode/shell';

import { terminalSession } from './cm-terminal-mode.ts';

/**
 * The languages the code editor can actually highlight.
 *
 * `markdown({ codeLanguages })` hands this to lezer, so this array — not any
 * list maintained elsewhere — is the truth for "what a fence language lights
 * up". `fence-languages.ts` derives the ``` completion list from it rather
 * than keeping a second copy that could drift.
 *
 * Moved out of `Editor.vue` for exactly that reason (issue #297). Behaviour is
 * unchanged: same entries, same order, same supports.
 */
const legacy = (
  name: string,
  alias: string[],
  loadParser: () => Promise<StreamParser<unknown>>,
): LanguageDescription =>
  LanguageDescription.of({
    name,
    alias,
    load: async () => new LanguageSupport(StreamLanguage.define(await loadParser())),
  });

const lazy = (name: string, alias: string[], load: () => Promise<LanguageSupport>): LanguageDescription =>
  LanguageDescription.of({ name, alias, load });

/**
 * Everything past the original fourteen loads on first use, so a document
 * without a ```kotlin fence never downloads the Kotlin grammar. Names follow
 * highlight.js where it has the language, so one fence colours both the code
 * editor and the preview (hljs-languages.ts registers the extras there).
 */
const LAZY_LANGUAGES: LanguageDescription[] = [
  lazy('php', [], () => import('@codemirror/lang-php').then((m) => m.php())),
  legacy('csharp', ['cs', 'c#'], () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.csharp)),
  legacy('kotlin', ['kt', 'kts'], () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.kotlin)),
  legacy('ruby', ['rb'], () => import('@codemirror/legacy-modes/mode/ruby').then((m) => m.ruby)),
  legacy('swift', [], () => import('@codemirror/legacy-modes/mode/swift').then((m) => m.swift)),
  legacy('dockerfile', ['docker'], () => import('@codemirror/legacy-modes/mode/dockerfile').then((m) => m.dockerFile)),
  legacy('powershell', ['ps1', 'pwsh'], () => import('@codemirror/legacy-modes/mode/powershell').then((m) => m.powerShell)),
  legacy('dart', [], () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.dart)),
  legacy('lua', [], () => import('@codemirror/legacy-modes/mode/lua').then((m) => m.lua)),
  legacy('scala', [], () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.scala)),
  legacy('r', [], () => import('@codemirror/legacy-modes/mode/r').then((m) => m.r)),
  legacy('objectivec', ['objc', 'objective-c'], () => import('@codemirror/legacy-modes/mode/clike').then((m) => m.objectiveC)),
  legacy('scss', [], () => import('@codemirror/legacy-modes/mode/css').then((m) => m.sCSS)),
  legacy('less', [], () => import('@codemirror/legacy-modes/mode/css').then((m) => m.less)),
  legacy('sass', [], () => import('@codemirror/legacy-modes/mode/sass').then((m) => m.sass)),
  lazy('vue', [], () => import('@codemirror/lang-vue').then((m) => m.vue())),
  lazy('svelte', [], () => import('@replit/codemirror-lang-svelte').then((m) => m.svelte())),
  legacy('diff', ['patch'], () => import('@codemirror/legacy-modes/mode/diff').then((m) => m.diff)),
  legacy('toml', [], () => import('@codemirror/legacy-modes/mode/toml').then((m) => m.toml)),
  legacy('ini', ['properties', 'cfg'], () => import('@codemirror/legacy-modes/mode/properties').then((m) => m.properties)),
  legacy('nginx', [], () => import('@codemirror/legacy-modes/mode/nginx').then((m) => m.nginx)),
  legacy('perl', ['pl'], () => import('@codemirror/legacy-modes/mode/perl').then((m) => m.perl)),
  legacy('haskell', ['hs'], () => import('@codemirror/legacy-modes/mode/haskell').then((m) => m.haskell)),
  lazy('elixir', ['ex', 'exs'], () => import('codemirror-lang-elixir').then((m) => m.elixir())),
  lazy('graphql', ['gql'], () => import('cm6-graphql').then((m) => m.graphqlLanguageSupport())),
  lazy('hcl', ['terraform', 'tf'], () => import('codemirror-lang-hcl').then((m) => m.hcl())),
  legacy('groovy', ['gradle'], () => import('@codemirror/legacy-modes/mode/groovy').then((m) => m.groovy)),
  legacy('julia', ['jl'], () => import('@codemirror/legacy-modes/mode/julia').then((m) => m.julia)),
  legacy('protobuf', ['proto'], () => import('@codemirror/legacy-modes/mode/protobuf').then((m) => m.protobuf)),
  legacy('cmake', [], () => import('@codemirror/legacy-modes/mode/cmake').then((m) => m.cmake)),
  legacy('http', [], () => import('@codemirror/legacy-modes/mode/http').then((m) => m.http)),
  legacy('latex', ['tex'], () => import('@codemirror/legacy-modes/mode/stex').then((m) => m.stex)),
  legacy('matlab', ['octave'], () => import('@codemirror/legacy-modes/mode/octave').then((m) => m.octave)),
  legacy('django', ['jinja', 'jinja2'], () => import('@codemirror/legacy-modes/mode/jinja2').then((m) => m.jinja2)),
  legacy('pug', ['jade'], () => import('@codemirror/legacy-modes/mode/pug').then((m) => m.pug)),
  legacy('clojure', ['clj'], () => import('@codemirror/legacy-modes/mode/clojure').then((m) => m.clojure)),
  legacy('erlang', ['erl'], () => import('@codemirror/legacy-modes/mode/erlang').then((m) => m.erlang)),
  legacy('fsharp', ['fs', 'f#'], () => import('@codemirror/legacy-modes/mode/mllike').then((m) => m.fSharp)),
  legacy('ocaml', ['ml'], () => import('@codemirror/legacy-modes/mode/mllike').then((m) => m.oCaml)),
  legacy('elm', [], () => import('@codemirror/legacy-modes/mode/elm').then((m) => m.elm)),
  legacy('crystal', ['cr'], () => import('@codemirror/legacy-modes/mode/crystal').then((m) => m.crystal)),
  legacy('coffeescript', ['coffee'], () => import('@codemirror/legacy-modes/mode/coffeescript').then((m) => m.coffeeScript)),
  legacy('vbnet', ['vb'], () => import('@codemirror/legacy-modes/mode/vb').then((m) => m.vb)),
  legacy('vbscript', ['vbs'], () => import('@codemirror/legacy-modes/mode/vbscript').then((m) => m.vbScript)),
  legacy('fortran', ['f90'], () => import('@codemirror/legacy-modes/mode/fortran').then((m) => m.fortran)),
  legacy('delphi', ['pascal'], () => import('@codemirror/legacy-modes/mode/pascal').then((m) => m.pascal)),
  legacy('verilog', ['sv', 'systemverilog'], () => import('@codemirror/legacy-modes/mode/verilog').then((m) => m.verilog)),
  legacy('vhdl', [], () => import('@codemirror/legacy-modes/mode/vhdl').then((m) => m.vhdl)),
  legacy('gherkin', ['feature'], () => import('@codemirror/legacy-modes/mode/gherkin').then((m) => m.gherkin)),
  legacy('wasm', ['wat', 'wast'], () => import('@codemirror/legacy-modes/mode/wast').then((m) => m.wast)),
  legacy('tcl', [], () => import('@codemirror/legacy-modes/mode/tcl').then((m) => m.tcl)),
  legacy('scheme', [], () => import('@codemirror/legacy-modes/mode/scheme').then((m) => m.scheme)),
  legacy('lisp', ['commonlisp'], () => import('@codemirror/legacy-modes/mode/commonlisp').then((m) => m.commonLisp)),
  legacy('d', [], () => import('@codemirror/legacy-modes/mode/d').then((m) => m.d)),
  legacy('puppet', ['pp'], () => import('@codemirror/legacy-modes/mode/puppet').then((m) => m.puppet)),
  legacy('stylus', ['styl'], () => import('@codemirror/legacy-modes/mode/stylus').then((m) => m.stylus)),
  legacy('sparql', [], () => import('@codemirror/legacy-modes/mode/sparql').then((m) => m.sparql)),
  legacy('cypher', [], () => import('@codemirror/legacy-modes/mode/cypher').then((m) => m.cypher)),
];

export const codeLanguages = [
  LanguageDescription.of({ name: 'javascript', alias: ['js', 'jsx'], support: javascript({ jsx: true }) }),
  LanguageDescription.of({ name: 'typescript', alias: ['ts', 'tsx'], support: javascript({ jsx: true, typescript: true }) }),
  LanguageDescription.of({ name: 'python', alias: ['py'], support: python() }),
  LanguageDescription.of({ name: 'rust', alias: ['rs'], support: rust() }),
  LanguageDescription.of({ name: 'html', support: htmlLang() }),
  LanguageDescription.of({ name: 'css', support: cssLang() }),
  LanguageDescription.of({ name: 'json', support: jsonLang() }),
  LanguageDescription.of({ name: 'cpp', alias: ['c', 'c++'], support: cpp() }),
  LanguageDescription.of({ name: 'java', support: java() }),
  LanguageDescription.of({ name: 'go', alias: ['golang'], support: go() }),
  LanguageDescription.of({ name: 'yaml', alias: ['yml'], support: yaml() }),
  LanguageDescription.of({ name: 'sql', support: sql() }),
  LanguageDescription.of({ name: 'xml', support: xml() }),
  LanguageDescription.of({
    name: 'bash',
    alias: ['sh', 'zsh', 'shell'],
    support: new LanguageSupport(StreamLanguage.define(shell)),
  }),
  LanguageDescription.of({
    name: 'terminal',
    alias: ['console', 'shell-session'],
    support: new LanguageSupport(StreamLanguage.define(terminalSession)),
  }),
  ...LAZY_LANGUAGES,
];
