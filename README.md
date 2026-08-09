<p align="center">
  <img src="logo.png" width="128" height="128" alt="Jakarta Faces Tools Logo">
</p>

# Jakarta Faces Tools:
Advanced Jakarta Faces (JSF) extension bringing full IDE-grade intelligence to VS Code. Features intelligent EL autocomplete with Lombok support, real-time semantic diagnostics, deep Java jump-to-definition, zero-config custom composite components, and first-class support for PrimeFaces, OmniFaces, and BootsFaces.

Supercharge your Jakarta Faces development with deep language features for .xhtml and .jsf files. From instant Managed Bean and iteration variable suggestions to real-time Expression Language error checking and component ID wiring, this extension transforms VS Code into a first-class JSF development environment.


# Features:
### + Expression Language (EL) IntelliSense (Autocomplete):
Get intelligent auto-complete for your Java Managed Beans, iteration variables, and properties inside Expression Language (EL) `#{...}` expressions! Enabled by default (`jakartaFacesTools.enableELAutocomplete: true`).
- **Immediate Root Bean & Smart EL Snippets**: Typing `{` inside `#{|}` immediately pops up all Managed Beans and iteration variables. Even better, typing `"` or `'` inside EL-capable tag attributes (e.g., `value="`, `action="`, `rendered="`) immediately displays `#{beanName}` snippets so selecting one inserts the full EL expression instantly!
- **Lombok Annotation Support**: Fully supports Project Lombok annotations (`@Data`, `@Getter`, `@Value`, `@Builder`, and field-level `@Getter`). Automatically recognizes Lombok-annotated Java classes and maps fields to EL getter properties (`.username`, `.active`), including primitive `boolean` (`is...()`) vs boxed `Boolean` (`get...()`) return types!
- **Incremental Bean Caching**: Equipped with real-time Java file system watchers (`**/*.java`) that update or remove beans from cache non-destructively as you create, edit, or delete `.java` files without needing to rebuild the entire project cache. Configurable via `jakartaFacesTools.enableIncrementalCache` (default: `true`).
- **Iteration Variable Support (`var="..."`)**: Full intelligence for JSF iteration variables in `.xhtml` and `.jsf` files (`<ui:repeat>`, `<h:dataTable>`, `<p:dataTable>`, `<p:dataList>`, `<p:carousel>`, `<c:forEach>`). Typing inside `#{u.|}` resolves `u` to its collection element type (stripping generic wrappers like `List<User>` → `User`) and suggests methods and properties of `User.java`.
- **Standards-Compliant Property & Method Suggestions**: Follows JSF & NetBeans completion standards by filtering out `get`/`is` prefixes from completion lists (suggesting clean `.property` and `.method()` names) and automatically inserting snippet parens for methods (`method($0)`). Also supports direct method resolution (e.g. `#{user.getName}`).
- **Rich Inline Data Types, Scopes & API Cards**: Every item in the completion list displays its data type with a clean colon prefix (` : String`, ` : ArrayList<User>`, ` : int`) and color-coded scope badge (`🟢 @ViewScoped`, `🟡 @RequestScoped`), along with a beautifully styled Markdown documentation fly-out card.
- **Comment-Stripped Safe Resolution**: Smart regex scanning ignores commented-out Java methods and properties (`//` and `/* ... */`) while preserving 100% accurate line numbers and columns for `Ctrl+Click` definition jumps.
- **Status Bar Cache Manager**: Includes a convenient Status Bar button (`$(coffee) Rebuild JSF Cache`) to force an in-memory bean scan when beans are added or modified outside of normal edits.


### + Configurable Expression Language (EL) coloring and Highlighting:
Make your code pop and significantly improve readability with native syntax highlighting for Expression Language (EL) expressions.
- **EL Block Highlighting**: All EL expressions (`#{...}`) are automatically highlighted to distinguish them from standard HTML/XML.
- **Highly Customizable**: Head to your VS Code Settings (`Jakarta Faces Tools: EL Highlighting`) to completely customize the background color, text color, borders, and border-radius of your EL expressions.
- **Backward Compatible**: Existing user customizations from legacy settings (`elHighlight.*`) are fully preserved.


### + Advanced Jump-to-Definition (Ctrl+Click):
Navigate seamlessly through your JSF project structure and Java backend with standard `Ctrl+Click` interactions.
- **Deep Nested Java EL Resolution**: `Ctrl+Click` on any segment of an Expression Language binding (e.g. `#{myBean.user.address.street}`) to instantly jump to the underlying Java Bean class, and iteratively resolve the exact property or field definition at any depth level! The extension automatically strips Generic wrappers (like `List<T>`) to find the exact target.
- **Template Navigation**: `Ctrl+Click` on `template="/WEB-INF/templates/master.xhtml"` to open the template file.
- **Resource Navigation**: `Ctrl+Click` on `#{resource['css/styles.css']}` to instantly open the corresponding static resource from your `src/main/webapp/resources` folder.

### + Standard and 3rd-Party Tag Intelligence:
Enjoy first-class support for standard JSF 4.1 tags (`<h:`, `<f:`, `<ui:`) as well as major 3rd-party libraries including **PrimeFaces**, **OmniFaces**, and **BootsFaces**.
- **IntelliSense (Autocomplete) with Inline Types**: Start typing a tag or hit `Ctrl+Space` inside a tag to get auto-complete suggestions for standard and 3rd-party JSF attributes, displaying their data types (` : String`, ` : boolean`) right in the completion list!
- **Interactive Documentation Fly-out Cards**: Press `Ctrl+Space` while browsing attributes in the autocomplete list to view live, formatted Markdown documentation cards with type badges and clean API descriptions without having to type the attribute.
- **Rich Tag Documentation Hover**: Hover over any standard or supported 3rd-party JSF tag to see a concise description of what the component does, along with a direct link to the official documentation.
- **Attribute Hover Documentation**: Hover over any standard or 3rd-party JSF attribute (e.g. `value`, `rendered`) to see a rich markdown popup containing the attribute's description, type, default value, and expected method signature!
- **Required Attribute Validation**: The extension strictly enforces standard `<taglib>` validation rules. If you omit a required attribute (like the `name` attribute in `<f:param>`), the extension will instantly highlight the tag with a red error squiggly!

### + Custom Composite Components Support:
Built-in intelligence for your workspace's custom JSF Composite Components without any manual configuration!
- **Dynamic Namespace Parsing**: The extension reads your `xmlns:` declarations (e.g. `xmlns:tc="jakarta.faces.composite/tc"`) on-the-fly to discover your custom folders.
- **Custom Tag IntelliSense (Autocomplete)**: Start typing your custom prefix (e.g., `<tc:`) and the extension will scan your workspace's `resources` folder and suggest all the `.xhtml` components it finds.
- **Custom Attribute IntelliSense (Autocomplete)**: Type inside a custom component tag (e.g., `<tc:labeledInput |>`) and it will dynamically read the target component file and suggest all the `<cc:attribute>` names you defined inside it!
- **Jump to Custom Component**: `Ctrl+Click` on a custom tag name to jump directly to the component's `.xhtml` file in your workspace.
- **Jump to Custom Attribute**: `Ctrl+Click` on a specific attribute in your custom tag to jump precisely to that `<cc:attribute>` definition line inside the component file!

### + Real-time EL & Syntax Diagnostics:
Catch JSF and Expression Language mistakes before you ever run the application.
- **EL Semantic Validation**: Real-time semantic checking inside `#{...}` Expression Language expressions. Warns if you reference an unknown Managed Bean name (`#{unknownBean.foo}`) or a mistyped property (`#{userController.naem}`) that does not exist on your Java class. Supports Lombok `@Data`, `@Getter`, `@Value`, and `@Builder` annotations as well as recursive checking across deeply nested property chains (`#{a.b.c.d}`). Automatically refreshes diagnostics immediately when a Managed Bean `.java` file is saved! Automatically whitelists all standard JSF implicit objects (`resource`, `cc`, `param`, `session`, etc.), EL keywords, and iteration variables (`<ui:repeat var="u">`). Includes intelligent debouncing and document version checking for stable, flicker-free squigglies.
- **Type-Safe EL Method Validation**: Real-time semantic checking for method expressions! When you type an EL expression inside a component attribute (e.g., `actionListener="#{bean.myProperty}"`), the extension automatically looks up the attribute in its JSF catalogs. If the attribute requires a specific Java `<method-signature>`, the engine strictly enforces that your EL resolves to a real method. If you mistakenly bind it to a field or getter, it throws a semantic warning: *"The attribute 'actionListener' expects a method with signature 'void actionListener(...)', but 'myProperty' is a property/field."*
- **Full Workspace Diagnostics**: Take advantage of the "Scan JSF Workspace" feature (via Status Bar button or Command Palette) to validate all `.xhtml` and `.jsf` files across your entire project at once, populating the Problems panel with missing required attributes and EL errors even for files you haven't opened yet!
- **EL Syntax Checking**: The extension runs in the background and will flag unmatched Expression Language brackets (e.g. `#{myBean` missing the closing `}`) with a red error squiggly.
- **Unknown Tag and Attribute Detection**: Mistyped standard or 3rd-party tags (e.g., `<h:outpottText>`) as well as unrecognized attributes will be flagged with a yellow warning squiggly.

### + Component Linking & Navigation (`for="..."` ↔ `id="..."`)
Enjoy NetBeans and Eclipse-grade form wiring for Jakarta Faces, PrimeFaces, OmniFaces, and BootsFaces `.xhtml` and `.jsf` files!
- **Immediate Component ID Autocomplete**: Typing `"` or `'` inside `for="..."` or `target="..."` immediately displays all available component `id="..."` declarations in the active file without requiring typing the first character of the ID! Each item includes a clean right-aligned tag name description (` : h:inputText`) and styled Markdown documentation card.
- **Jump-to-Definition (`Ctrl+Click` / F12)**: Clicking on `for="myInput"` or `target="myDialog"` instantly jumps the editor cursor directly to `<h:inputText id="myInput">` or `<p:dialog id="myDialog">`.
- **Simultaneous Document Highlighting**: Placing your cursor on any `id="foo"` or `for="foo"` value automatically illuminates both the ID declaration (`Write` highlight) and all linked references (`Read` highlight) across the entire editor.
- **Interactive Hover Summary Cards**: Hovering over `id="foo"` displays a styled Markdown card summarizing all linked components and line numbers; hovering over `for="foo"` displays the target tag declaration and line number.

### + Managed Bean Scope Awareness & Inline Inlay Hints:
Enjoy instant CDI and Faces scope visibility (`@ViewScoped`, `@RequestScoped`, `@SessionScoped`, `@ApplicationScoped`, etc.) right inside your `.xhtml` and `.jsf` files without having to open the backend Java class!
- **In-Code Scope Badges via VS Code Inlay Hints**: Automatically renders clean annotation-style badges (`@ViewScoped : ` or ` : @ViewScoped`) around Expression Language blocks (`@ViewScoped : #{userController.username}`) in the editor.
- **Interactive Scope Tooltips**: Hover over any inline scope badge to view an interactive Markdown card displaying the Managed Bean class, exact scope import package, and a clear lifecycle description (e.g., *"Survives across AJAX postbacks within the same view"*).
- **Color-Coded Scope Badges in Autocomplete**: When typing inside `#{...}`, autocomplete items and detail fly-outs display intuitive color-coded scope badges (`🟢 @ViewScoped`, `🟡 @RequestScoped`, `🔵 @SessionScoped`, `🟣 @ApplicationScoped`).
- **Flexible & Configurable**: Easily configure badge positioning (`Pre-EL` vs `Post-EL` via `jakartaFacesTools.inlineBeanScopesPosition`) or toggle inline scopes entirely (`jakartaFacesTools.showInlineBeanScopes`).
- **Scope-Aware Best-Practice Diagnostics (Experimental)**: Optionally enable intelligent recommendations (`jakartaFacesTools.enableScopeWarnings`) when binding `@RequestScoped` beans to stateful data components (`<h:dataTable>`, `<p:dataTable>`, etc.) to prevent pagination and state loss on AJAX postbacks.

## Supported Versions:
The extension currently provides intelligence and documentation derived from the following specification versions:
- **Jakarta Faces (JSF)**: 4.1
- **PrimeFaces**: 15.0.0
- **OmniFaces**: 5.3.4
- **BootsFaces**: 2.0.1

## Requirements:
- Works best in standard Maven-structured projects with `src/main/webapp/resources` folders, but is flexible enough to adapt to other directory structures.
- Does not require a Java Language Server to be running, but synergizes excellently with standard Java extensions.

## Feedback & Contributions:
We would love to hear from you! If you have any feedback, want to request new features, or need to report an issue, please feel free to open an issue on our [GitHub Repository](https://github.com/Moataz-Aldawood/jakarta-faces-tools). Your contributions and suggestions are highly appreciated!

## 💖 Buy / Support / Sponser This Extension:
**Jakarta Faces Tools** is provided **100% free without any limitations or paywalls** for testing, evaluation, and personal use.

If you use this extension regularly for professional or commercial development, please **buy a supporter license / support the project on GitHub**! Your support keeps this tool actively maintained and growing.
- **[💖 Buy / Support Jakarta Faces Tools on GitHub Sponsors](https://github.com/sponsors/Moataz-Aldawood)**
