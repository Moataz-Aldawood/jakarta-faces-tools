# Jakarta Faces Tools

Advanced VS Code extension for Jakarta Faces (JSF) development, featuring intelligent Java EL resolution, deep composite component analysis, and comprehensive 3rd-party tag library support.

**☕ Buy / Support This Extension:** [Sponser Jakarta Faces Tools](https://github.com/sponsors/Moataz-Aldawood)  
**GitHub Repository:** [https://github.com/Moataz-Aldawood/jakarta-faces-tools](https://github.com/Moataz-Aldawood/jakarta-faces-tools)  


A powerful Visual Studio Code extension designed to supercharge your Jakarta Faces (JSF) development experience. This extension provides deep language features for JSF `.xhtml` and `.jsf` files, bringing IDE-level intelligence to VS Code.

## Features:

### 1. Experimental EL Autocomplete [Beta Feature]
Get intelligent auto-complete for your Java Managed Beans and properties inside Expression Language (EL) `#{...}` expressions!
- **Managed Bean Discovery**: Automatically detects Java beans annotated with `@Named`, `@ManagedBean`, `@Controller`, or `@Component` across your workspace.
- **Property & Method Suggestions**: Type inside `#{myBean.|}` to instantly view available fields, getters, and methods with their return types.
- **Status Bar Cache Manager**: Includes a convenient Status Bar button (`$(coffee) Rebuild JSF Cache`) to force an in-memory bean scan when beans are added or modified outside of normal edits.
- **Why is it Disabled by Default? (Opt-in Beta)**: Our core JSF tools are rock-solid and stable. EL Autocomplete requires in-memory cache management and background scanning of Java Managed Beans across your workspace, which is currently in an early experimental phase. To guarantee zero disruption or caching issues for current users, this feature is **disabled by default** for early releases.
- **How to Enable**: Easily turn it on anytime under **`Settings > Jakarta Faces Tools > Enable EL Autocomplete`** (`jakartaFacesTools.enableELAutocomplete`).


### 2. Configurable EL Highlighting
Make your code pop and significantly improve readability with native syntax highlighting for Expression Language (EL) expressions.
- **EL Block Highlighting**: All EL expressions (`#{...}`) are automatically highlighted to distinguish them from standard HTML/XML.
- **Highly Customizable**: Head to your VS Code Settings (`Jakarta Faces Tools: EL Highlighting`) to completely customize the background color, text color, borders, and border-radius of your EL expressions.
- **Backward Compatible**: Existing user customizations from legacy settings (`elHighlight.*`) are fully preserved.



### 3. Advanced Jump-to-Definition (Ctrl+Click)
Navigate seamlessly through your JSF project structure and Java backend with standard `Ctrl+Click` interactions.
- **Deep Nested Java EL Resolution**: `Ctrl+Click` on any segment of an Expression Language binding (e.g. `#{myBean.user.address.street}`) to instantly jump to the underlying Java Bean class, and iteratively resolve the exact property or field definition at any depth level! The extension automatically strips Generic wrappers (like `List<T>`) to find the exact target.
- **Template Navigation**: `Ctrl+Click` on `template="/WEB-INF/templates/master.xhtml"` to open the template file.
- **Resource Navigation**: `Ctrl+Click` on `#{resource['css/styles.css']}` to instantly open the corresponding static resource from your `src/main/webapp/resources` folder.

### 4. Standard and 3rd-Party Tag Intelligence
Enjoy first-class support for standard JSF 4.1 tags (`<h:`, `<f:`, `<ui:`) as well as major 3rd-party libraries including **PrimeFaces**, **OmniFaces**, and **BootsFaces**.
- **Auto-Complete**: Start typing a tag or hit `Ctrl+Space` inside a tag to get auto-complete suggestions for both standard/3rd-party JSF tags and all their available attributes.
- **Rich Tag Documentation Hover**: Hover over any standard or supported 3rd-party JSF tag to see a concise description of what the component does, along with a direct link to the official documentation.
- **Attribute Hover Documentation**: Hover over any standard or 3rd-party JSF attribute (e.g. `value`, `rendered`) to see a rich markdown popup containing the attribute's description and type!

### 5. Custom Composite Components Support
Built-in intelligence for your workspace's custom JSF Composite Components without any manual configuration!
- **Dynamic Namespace Parsing**: The extension reads your `xmlns:` declarations (e.g. `xmlns:tc="jakarta.faces.composite/tc"`) on-the-fly to discover your custom folders.
- **Custom Tag Auto-Complete**: Start typing your custom prefix (e.g., `<tc:`) and the extension will scan your workspace's `resources` folder and suggest all the `.xhtml` components it finds.
- **Custom Attribute Auto-Complete**: Type inside a custom component tag (e.g., `<tc:labeledInput |>`) and it will dynamically read the target component file and suggest all the `<cc:attribute>` names you defined inside it!
- **Jump to Custom Component**: `Ctrl+Click` on a custom tag name to jump directly to the component's `.xhtml` file in your workspace.
- **Jump to Custom Attribute**: `Ctrl+Click` on a specific attribute in your custom tag to jump precisely to that `<cc:attribute>` definition line inside the component file!

### 6. Real-time Syntax Error Diagnostics
Catch JSF mistakes before you ever run the application.
- **EL Syntax Checking**: The extension runs in the background and will flag unmatched Expression Language brackets (e.g. `#{myBean` missing the closing `}`) with a red error squiggly.
- **Unknown Tag and Attribute Detection**: Mistyped standard or 3rd-party tags (e.g., `<h:outpottText>`) as well as unrecognized attributes will be flagged with a yellow warning squiggly.

## Supported Versions
The extension currently provides intelligence and documentation derived from the following specification versions:
- **Jakarta Faces (JSF)**: 4.1
- **PrimeFaces**: 15.0.0
- **OmniFaces**: 5.3.4
- **BootsFaces**: 2.0.1

## Requirements
- Works best in standard Maven-structured projects with `src/main/webapp/resources` folders, but is flexible enough to adapt to other directory structures.
- Does not require a Java Language Server to be running, but synergizes excellently with standard Java extensions.

## Feedback & Contributions
We would love to hear from you! If you have any feedback, want to request new features, or need to report an issue, please feel free to open an issue on our [GitHub Repository](https://github.com/Moataz-Aldawood/jakarta-faces-tools). Your contributions and suggestions are highly appreciated!

## ☕ Buy / Support This Extension
**Jakarta Faces Tools** is provided **100% free without any limitations or paywalls** for testing, evaluation, and personal use.

If you use this extension regularly for professional or commercial development, please **buy a supporter license / support the project on GitHub**! Your support keeps this tool actively maintained and growing.
- **[💖 Buy / Support Jakarta Faces Tools on GitHub Sponsors](https://github.com/sponsors/Moataz-Aldawood)**

## License
This project is licensed under the GPL-3.0 License.
