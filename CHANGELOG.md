# Changelog

All notable changes to the "jakarta-faces-tools" extension will be documented in this file.

## [2.5.0] - 2026-08-01
### Added
- **Incremental Bean Caching (File Watchers)**: Real-time file system watchers (`**/*.java`) that detect `.java` file creations, modifications, and deletions without rebuilding the entire project cache.
- **Configurable Incremental Caching Toggle**: Added setting `jakartaFacesTools.enableIncrementalCache` (enabled by default) to allow developers to toggle real-time `.java` file watching and save synchronization in very large repositories or network drives.
- **Lombok Annotation Support**: Complete recognition for Lombok annotations (`@Data`, `@Getter`, `@Value`, `@Builder`) in JavaBeans property resolution.
- **Selective Field-Level `@Getter` Support**: Correctly maps fields individually annotated with `@Getter` or `@lombok.Getter` to EL property getters when class-level annotations are absent.
- **Primitive vs Boxed Boolean Compatibility**: Automatically generates `is...()` getters for primitive `boolean` fields and `get...()` getters for boxed `Boolean` fields per JavaBeans standard.
- **Safe Generic Declaration Parsing**: Accurately parses comma-separated declarations and generics (e.g., `private Map<String, Object> metadata;`) without splitting generic type parameters.

## [2.4.0] - 2026-08-01
### Added
- **EL Semantic Validation (Real-time Diagnostics)**: Real-time semantic diagnostics to flag mistyped Java Managed Bean names and property names inside `#{...}` Expression Language blocks.
- **Unknown Root Bean Warnings**: Automatically flags expressions referencing non-existent bean names with a yellow warning squiggly (`Jakarta Faces: Unknown Managed Bean or EL variable 'foo'.`).
- **Unknown Property Warnings**: Verifies whether `.propertyName` exists on the target Managed Bean Java class and warns if mistyped (`Jakarta Faces: Property 'naem' not found in Managed Bean 'userController' (UserController).`).
- **Deep Nested Property Chain Validation**: Recursively inspects arbitrary depths of dotted property chains (e.g., `#{a.b.c.d}`), resolving return types across multiple Java classes and warning on mistyped segments.
- **Stable Debounced Diagnostics**: Built-in 250ms debouncing and document version checking to prevent squiggly lines from flashing, shifting left, or jumping while editing.
- **Whitelisted Implicit Objects & Keywords**: Built-in protection against false positives by whitelisting all standard JSF/EL implicit objects (`resource`, `cc`, `param`, `session`, `request`, etc.), operators, literals, and iteration variables (`<ui:repeat var="u">`).
- **Configurable Toggle**: Added setting `jakartaFacesTools.enableELDiagnostics` (enabled by default) to customize or toggle semantic EL warnings in VS Code Settings.

## [2.3.0] - 2026-08-01
### Added
- **Component Linking & Navigation (`for="..."` ↔ `id="..."`)**: Full NetBeans and Eclipse-grade form wiring for Jakarta Faces, PrimeFaces, OmniFaces, and BootsFaces `.xhtml` and `.jsf` files.
- **Component ID Autocomplete**: Typing inside `for="..."` or `target="..."` lists all available component `id="..."` declarations in the active file with clean right-aligned tag name descriptions (` : h:inputText`).
- **Jump-to-Definition (`Ctrl+Click` / F12)**: Clicking on `for="myInput"` or `target="myDialog"` instantly jumps the cursor directly to `<h:inputText id="myInput">` or `<p:dialog id="myDialog">`.
- **Simultaneous Document Highlighting**: Placing the cursor on any `id="foo"` or `for="foo"` value automatically illuminates both the ID declaration (`Write` highlight) and all linked references (`Read` highlight) across the entire editor.
- **Interactive Hover Summary Cards**: Hovering over `id="foo"` displays a styled Markdown card summarizing all linked components and line numbers; hovering over `for="foo"` displays the target tag declaration and line number.
- **Standardized Visual Branding**: Standardized all documentation popups, hover cards, and status bar items to use the monochrome VS Code Codicon coffee cup (`*$(coffee) Jakarta Faces Tools*`) with automatic theme adaptation.

## [2.2.0] - 2026-08-01
### Added
- **EL Autocomplete Enabled by Default**: Enabled `jakartaFacesTools.enableELAutocomplete` by default (`true`).
- **Iteration Variable Support (`var="..."`)**: Full intelligence for iteration variables in `.xhtml` and `.jsf` files (`<ui:repeat>`, `<h:dataTable>`, `<p:dataTable>`, `<p:dataList>`, `<p:carousel>`, `<c:forEach>`).
- **Iteration Variable EL Autocomplete**: Typing inside `#{u.|}` resolves `u` to its collection element type (stripping generic wrappers like `List<User>` → `User`) and suggests methods and properties of `User.java`.
- **Iteration Variable Jump-to-Definition**: `Ctrl+Click` on variable names jumps directly to `var="..."` in the `.xhtml` file; clicking properties jumps directly to Java property definitions in `User.java`.
- **Standards-Compliant Method Snippets**: Automatically inserts method call snippets (`method($0)`) when selecting methods in EL completion lists, and supports direct method resolution (`#{user.getName}`).
- **Rich Inline Data Types**: All completion items (properties, methods, managed beans, iteration variables, and tag attributes) now display their data types with a clean colon prefix (` : String`, ` : ArrayList<User>`, ` : int`).
- **Interactive Documentation Fly-out Cards**: Tag attribute completions now feature styled Markdown documentation cards with prominent headers, type badges (`**Type:** String`), and cleaned description text when browsing via `Ctrl+Space`.
- **Comment-Stripped Safe Resolution**: Smart regex scanning ignores commented-out Java methods and properties (`//` and `/* ... */`) while preserving 100% accurate line numbers and columns for `Ctrl+Click` definition jumps.
- **Unannotated Bean Fallback**: Automatic class name fallback resolution for unannotated managed beans.

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
