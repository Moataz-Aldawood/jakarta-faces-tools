# Changelog

All notable changes to the "jakarta-faces-tools" extension will be documented in this file.

### [3.1.0] - 2026-08-08
- **Full Workspace Diagnostics**: Added a new "Scan JSF Workspace" feature that validates all `.xhtml` and `.jsf` files across the entire project (not just opened files), populating the Problems panel with missing required attributes and EL errors.
- **New Settings**: 
  - `jakartaFacesTools.validateEntireWorkspace`: (Default: `false`) Optionally perform a full workspace scan on VS Code startup.
  - `jakartaFacesTools.showScanWorkspaceButton`: (Default: `true`) Toggle the visibility of the new "Scan JSF Workspace" Status Bar button.

### [3.0.2] - 2026-08-08
- **Standard Tag Required Validation**: Expanded the new required attribute validation engine to cover standard tags. The extension now parses official `.taglib.xml` schemas (JSF, PrimeFaces, OmniFaces, BootsFaces) to extract the `required` flag, strictly warning developers if they omit required standard attributes (e.g. `<f:param name="">`).
- **Future-Proofed Offline Catalogs**: Extension tag catalogs are now fully regenerated and include library versions, default values (`<default-value>`), and Java EL method signatures (`<method-signature>`) in preparation for future semantic tooltips and method parameter validation.

### [3.0.1] - 2026-08-08
- **Lombok `@Setter` Support**: Added support for parsing class-level and field-level `@Setter` annotations, emitting standalone `setXxx()` methods in EL autocomplete.
- **Missing Required Attribute Validation**: Structural validation engine now dynamically parses `.xhtml` files to detect `<cc:attribute required="true">` in Composite Components and emits warnings when required attributes are missing.
- **Improved Iteration Scoping**: Enhanced `iterationParser` to correctly support scoped `var` attributes on self-closing tags like `<f:selectItems>`, eliminating false-positive "Unknown Managed Bean" warnings on attributes like `itemValue="#{...}"`.
- **Inlay Hints Default Position**: Changed the default value of `jakartaFacesTools.inlineBeanScopesPosition` from `Pre-EL` to `Post-EL` (`#{bean} : @ViewScoped`).
### [3.0.0] - 2026-08-07 [Major Marketplace Release]
### Overview
Version 3.0.0 represents a massive, transformative release for **Jakarta Faces Tools**, combining all development milestones from v2.2.0 through v2.6.0 into a single, enterprise-ready release. This release brings Eclipse- and NetBeans-grade form wiring, real-time Java bean caching, Lombok annotation support, instant quote autocomplete, and deep EL semantic validation to VS Code.

### Highlights & Features
#### 🌟 Managed Bean Scope Awareness & Lifecycle Intelligence
- **Automatic CDI / Faces Scope Recognition**: Scans and extracts scope annotations (`@ViewScoped`, `@RequestScoped`, `@SessionScoped`, `@ApplicationScoped`, `@ConversationScoped`, `@FlowScoped`, `@Dependent`) from Java Managed Beans.
- **Color-Coded Scope Badges in EL Autocomplete**: Displays color-coded scope badges (`🟢 @ViewScoped`, `🟡 @RequestScoped`, `🔵 @SessionScoped`, `🟣 @ApplicationScoped`) directly in EL autocomplete items and detail strings.
- **In-Code Badges via VS Code Inlay Hints**: Renders clean annotation-style badges (`@ViewScoped : ` or ` : @ViewScoped`) around Expression Language blocks (`@ViewScoped : #{userController.username}`) in `.xhtml` and `.jsf` files. Supports both Pre-EL and Post-EL positioning via `jakartaFacesTools.inlineBeanScopesPosition`. Interactive Markdown hover tooltips respect `jakartaFacesTools.enableHoverCards`, and the entire feature can be toggled via `jakartaFacesTools.showInlineBeanScopes`.
- **Lifecycle Summary & Documentation Cards**: Autocomplete and hover cards surface concise lifecycle summaries (e.g., *"Survives across AJAX postbacks within the same view"*) along with class name, scope package import, and clickable file link.
- **Scope-Aware Best-Practice Diagnostics [Experimental Feature]**: Emits intelligent enterprise information recommendations when binding `@RequestScoped` beans to stateful data components (`<h:dataTable>`, `<p:dataTable>`, `<p:dataList>`, `<ui:repeat>`), preventing pagination, sorting, and state loss on postbacks. Disabled by default and selectable via `jakartaFacesTools.enableScopeWarnings`.

#### ⚡ Immediate Quote Autocomplete & Smart EL Snippets
- **Immediate Component ID Autocomplete (`for="..."` / `target="..."`)**: Autocomplete triggers immediately after typing a quote (`"` or `'`) inside `for="..."` and `target="..."` attributes, displaying all available component IDs in the active file without requiring typing the first character of the ID.
- **Immediate Root Bean Completion (`#{...}`)**: Typing `{` inside Expression Language `#{|}` and `${|}` blocks immediately displays all available Managed Beans and iteration variables without requiring typing the first character.
- **Smart Cursor Positioning (`$0`)**: Selecting a Managed Bean or iteration variable inside `#{|}` inserts the bean name and positions the cursor (`$0`) before the closing brace (`}`), allowing immediate `.` typing without duplicate braces (`#{{...}}`).
- **Clean EL Triggering**: EL autocomplete triggers exclusively inside `#{...}` and `${...}` expressions—never on attribute quotes (`"`)—preventing unwanted popups when typing simple string attribute values.
- **Official Class Icon (`C`) for Managed Beans**: Root Java Managed Beans render with VS Code's official Class badge icon (`CompletionItemKind.Class`), visually distinguishing backend Java classes from iteration variables and properties.
- **Automatic Attribute TriggerSuggest**: Selecting any tag attribute from autocomplete inserts `attr=""`, positions the cursor inside the quotes, and automatically executes `editor.action.triggerSuggest` for immediate Component ID completion.

#### 🛡️ EL Semantic Diagnostics & Real-Time Property Validation
- **EL Semantic Validation (Diagnostics)**: Real-time semantic diagnostics flag mistyped Java Managed Bean names and property names inside `#{...}` Expression Language blocks.
- **Unknown Root Bean Warnings**: Automatically flags expressions referencing non-existent bean names with a yellow warning squiggly (`Jakarta Faces: Unknown Managed Bean or EL variable 'foo'.`).
- **Unknown Property Warnings**: Verifies whether `.propertyName` exists on the target Managed Bean Java class and warns if mistyped (`Jakarta Faces: Property 'naem' not found in Managed Bean 'userController' (UserController).`).
- **Deep Nested Property Chain Validation**: Recursively inspects arbitrary depths of dotted property chains (`#{a.b.c.d}`), resolving return types across multiple Java classes and warning on mistyped segments.
- **Whitelisted Implicit Objects & Keywords**: Built-in protection against false positives by whitelisting all standard JSF/EL implicit objects (`resource`, `cc`, `param`, `session`, `request`, etc.), operators, literals, and iteration variables (`<ui:repeat var="u">`).

#### 🔗 Component ID Linking & Form Wiring (`for="..."` ↔ `id="..."`)
- **NetBeans- & Eclipse-Grade Form Wiring**: Complete wiring for Jakarta Faces, PrimeFaces, OmniFaces, and BootsFaces `.xhtml` and `.jsf` files.
- **Jump-to-Definition (`Ctrl+Click` / F12)**: Clicking on `for="myInput"` or `target="myDialog"` instantly jumps the cursor directly to `<h:inputText id="myInput">` or `<p:dialog id="myDialog">`.
- **Simultaneous Document Highlighting**: Placing the cursor on any `id="foo"` or `for="foo"` value automatically illuminates both the ID declaration (`Write` highlight) and all linked references (`Read` highlight) across the entire editor.
- **Interactive Hover Summary Cards**: Hovering over `id="foo"` displays a styled Markdown card summarizing all linked components and line numbers; hovering over `for="foo"` displays the target tag declaration and line number.

#### 🔄 Real-Time Incremental Bean Caching & File Watchers
- **Incremental Bean Caching (File Watchers)**: Real-time file system watchers (`**/*.java`) detect `.java` file creations, modifications, and deletions without rebuilding the entire project cache.
- **Configurable Incremental Caching Toggle**: Added setting `jakartaFacesTools.enableIncrementalCache` (enabled by default) to allow developers to toggle real-time `.java` file watching in very large repositories or network drives.

#### 🚀 Complete Lombok Annotation Support
- **Lombok Annotation Recognition**: Full recognition for Lombok annotations (`@Data`, `@Getter`, `@Value`, `@Builder`) in JavaBeans property resolution.
- **Selective Field-Level `@Getter` Support**: Correctly maps fields individually annotated with `@Getter` or `@lombok.Getter` to EL property getters when class-level annotations are absent.
- **Primitive vs Boxed Boolean Compatibility**: Automatically generates `is...()` getters for primitive `boolean` fields and `get...()` getters for boxed `Boolean` fields per JavaBeans standard.

#### 🔁 Iteration Variable Support (`var="..."`)
- **Full Iteration Variable Intelligence**: Deep resolution for iteration variables in `.xhtml` and `.jsf` files (`<ui:repeat>`, `<h:dataTable>`, `<p:dataTable>`, `<p:dataList>`, `<p:carousel>`, `<c:forEach>`).
- **Iteration Variable EL Autocomplete**: Typing inside `#{u.|}` resolves `u` to its collection element type (stripping generic wrappers like `List<User>` → `User`) and suggests methods and properties of `User.java`.
- **Iteration Variable Jump-to-Definition**: `Ctrl+Click` on variable names jumps directly to `var="..."` in the `.xhtml` file; clicking properties jumps directly to Java property definitions in `User.java`.

#### ⚙️ UI Settings & Codicon Monochrome Branding
- **Dedicated Hover Cards UI Setting**: Added `"Jakarta Faces Tools: Documentation & Hover Cards"` settings section with `jakartaFacesTools.enableHoverCards` (default `true`) allowing developers to toggle hover documentation cards from the Settings UI.
- **Standardized Codicon Branding**: Standardized all documentation popups, hover cards, and status bar items to use VS Code's monochrome Codicon coffee cup (`$(coffee) Jakarta Faces Tools`) with automatic theme adaptation.

## [2.1.0] - 2026-07-31
### Added
- **Experimental EL Autocomplete [Beta Feature]**: Added intelligent auto-complete for Java Managed Beans (`@Named`, `@ManagedBean`, `@Controller`, `@Component`) and properties inside Expression Language (EL) `#{...}` expressions. Disabled by default for early releases.
- **Rebuild JSF Cache Action**: Added a convenient Status Bar item (`$(coffee) Rebuild JSF Cache`) and command (`jakartaFacesTools.rebuildJsfCache`) to force a fresh scan of project Managed Beans.
- **Updated Logo**: New Java coffee cup logo!

### Changed
- **Settings Reorganization**: Split settings into `EL Autocomplete [Beta Feature]` and `EL Highlighting` sections with standardized titles and descriptions.
- **Backward Compatibility**: Fully preserved legacy highlighting settings (`jakartaFacesTools.elHighlight.*`) so existing user customizations continue to work seamlessly.

## [2.0.2] - 2026-07-15
### Fixed
- **Multi-line Tag Parsing Regression**: Fixed a critical issue where features like IntelliSense, Jump-to-Definition, and Hover Documentation failed to trigger for JSF tags (especially custom composite components) that spanned across multiple lines. The extension now uses an advanced robust tag parser that accurately extracts enclosing tags regardless of formatting.

## [2.0.0] - 2026-07-14
### Added
- **Deep Nested Java EL Resolution**: Complete support for iterative resolution of nested Java beans (e.g. `#{myBean.user.address.street}`) with automatic generic type stripping.
- **Custom Composite Components Intelligence**: Full, dynamic workspace scanning for custom namespaces and attributes without any manual configuration.
- **Real-time Diagnostics**: Added in-editor syntax validation for EL brackets, unknown tags, and undefined attributes.
- **Configurable EL Highlighting**: Added native syntax highlighting for `#{...}` expressions to improve code readability, fully customizable via VS Code settings.
- **Third-Party Support**: Added out-of-the-box auto-complete and documentation hover for PrimeFaces (15.0.0), OmniFaces (5.3.4), and BootsFaces (2.0.1).

### Changed
- Replaced visual document links with seamless Definition Provider implementations to remove unwanted permanent underlines on JSF tags and resources.
