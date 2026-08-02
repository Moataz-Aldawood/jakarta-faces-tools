# Jakarta Faces Tools Backlog & Roadmap

## ✅ Completed (v2.4.0)
- [x] **EL Semantic Validation (Diagnostics)**: Optional real-time semantic diagnostics to flag mistyped Java Managed Bean names or missing property names inside `#{...}` expressions (e.g., warning on `#{userController.naem}`), with deep recursive property chain resolution (`#{a.b.c.d}`), debounced document version checking for stable squigglies, and automatic whitelisting of standard implicit objects and keywords.

## ✅ Completed (v2.3.0)
- [x] **Component Linking & Navigation (`for="..."` ↔ `id="..."`)**: Auto-complete available `id="..."` values when typing inside `for="..."` or `target="..."`, interactive Hover summary cards for `id`/`for`, simultaneous Document Highlighting of declarations and references, and `Ctrl+Click` jump-to-definition.

## ✅ Completed (v2.2.0)
- [x] **Iteration Variable Support (`var="..."`)**: Deep resolution, standards-compliant auto-complete, and jump-to-definition for iteration variables (e.g., `var="u"` in `<ui:repeat>`, `<h:dataTable>`, `<p:dataTable>`).
- [x] **Standards-Compliant EL Autocomplete**: Enabled by default with method call snippet parens, JSF getter/setter filtering, and comment-stripped safe resolution.
- [x] **Rich Inline Data Types & API Cards**: Clean colon-prefixed type descriptions (` : String`) on autocomplete rows and interactive documentation cards.

## ✅ Completed (v2.1.0)
- [x] **EL Expression Highlighting**: Customizable syntax highlighting for JSF Expression Language `#{...}` blocks.
- [x] **EL Auto-Complete (IntelliSense) [Beta]**: Auto-complete for Java Managed Beans, properties, and methods inside `#{...}` blocks, with Status Bar cache management.

## ✅ Completed (v2.5.0)
- [x] **Incremental Bean Caching (File Watchers)**: Automatically update the in-memory Java Managed Bean cache whenever a `.java` file is created, modified, or deleted without requiring a manual cache rebuild.
- [x] **Lombok Annotation Support**: Fully support `@Data`, `@Getter`, `@Value`, `@Builder`, and selective field-level `@Getter` annotations from Lombok when inspecting Java Managed Beans for EL properties.

## ✅ Completed (v2.6.0)
- [x] **Immediate Quote Autocomplete for Component IDs (`for="..."` / `target="..."`)**: Autocomplete triggers immediately after typing a quote (`"` or `'`) inside `for="..."` and `target="..."` attributes, displaying all available component IDs without requiring typing the first character.
- [x] **Automatic Attribute TriggerSuggest**: Selecting any tag attribute from autocomplete inserts `attr=""`, positions cursor inside quotes, and automatically executes `editor.action.triggerSuggest`.
- [x] **Clean EL Triggering**: EL autocomplete triggers exclusively inside `#{...}` and `${...}` expressions—never on attribute quotes (`"`)—preventing unwanted popups when typing simple string attribute values.
- [x] **Smart Cursor Positioning (`$0`)**: Selecting a Managed Bean inside `#{|}` inserts the bean name and positions the cursor before `}` (`${beanName}$0`), allowing immediate `.` typing without duplicate braces (`#{{...}}`).
- [x] **Official Class Icon (`C`) & Signature Branding**: Managed Beans display VS Code's official Class badge icon (`CompletionItemKind.Class`). All Markdown hover and completion documentation cards standardize on our `$(coffee) Jakarta Faces Tools` signature.
- [x] **Dedicated Hover Cards UI Setting**: Added `"Jakarta Faces Tools: Documentation & Hover Cards"` settings category with `jakartaFacesTools.enableHoverCards` (default `true`) to toggle hover cards from the Settings UI.

## ✅ Completed (v3.0.0)
- [x] **Managed Bean Scope Awareness & Lifecycle Intelligence**:
  - **Scope Recognition**: Parse Java/CDI scope annotations (`@RequestScoped`, `@ViewScoped`, `@SessionScoped`, `@ApplicationScoped`, `@ConversationScoped`, `@FlowScoped`, `@Dependent`) during bean scanning.
  - **Autocomplete Scope Badges**: Display scope in autocomplete completion row descriptions (` : UserController  (@ViewScoped)`) and Markdown fly-out documentation cards.
  - **Interactive Scope Hover Cards**: Hovering over `#{userController}` displays a dedicated table row showing the bean scope, import package (`jakarta.faces.view.ViewScoped`), and lifecycle summary.
  - **Scope-Aware Best-Practice Diagnostics**: Warn developers when binding stateful components (`<h:dataTable>`, `<p:dataTable>`, `<p:dataList>`, `<ui:repeat>`) to `@RequestScoped` backing beans.

## 🚀 Next Up (Version 3.0 Pro & Enterprise Features / Roadmap)
- [ ] **External JAR & Multi-Module Enterprise Library Support (3-Tier Architecture)**:
  - **Tier 1 (Multi-Root Workspace - Already Supported)**: Full cross-project EL autocomplete and diagnostics across multi-root `.code-workspace` folders when entities, controllers, and composite components reside in separate source repositories.
  - **Tier 2 (Configurable External JAR Scanning)**: Add setting `jakartaFacesTools.externalJarPaths` to scan external library JARs (`.jar` and `-sources.jar`) using a lightweight zero-dependency ZIP parser.
  - **Tier 3 (Automated Library Inspection)**:
    - *Composite Components in JAR*: Extract custom composite component `.xhtml` files from `META-INF/resources/<namespace>/<component>.xhtml` inside JARs, making external UI library tags and `<cc:attribute>` attributes available in IntelliSense.
    - *XML Configuration in JAR*: Read `META-INF/faces-config.xml` in external JARs for explicit bean and navigation rule declarations.
    - *Backing Beans & JPA Entities in JAR*: Extract properties and getters from `-sources.jar` archives or directly from `.class` bytecode constant pools without requiring a heavy Java JVM.
- [ ] **Spring Boot / CDI Annotation Support (`@Component`, `@Service`, `@Controller`, `@Model`, `@Inject`)**: Extend Java Bean scanning to recognize Spring Boot and Jakarta CDI component annotations for EL-accessible beans (crucial for JoinFaces & modern Spring Boot + JSF apps).
- [ ] **i18n Resource Bundle EL Support (`#{msg['...']}`)**: Parse `.properties` message bundles and `<f:loadBundle>` / `faces-config.xml` resource bundles to provide auto-complete and hover translation previews for internationalization keys.
- [ ] **EL Quick Fixes & Code Actions (`Ctrl+.`)**: Provide VS Code Lightbulb Quick Fixes for EL semantic warnings (e.g., suggesting "Did you mean `username`?" for mistyped properties or generating missing Java getter methods).
- [ ] **JSF/Faces Config XML Parsing (`faces-config.xml`)**: Support explicit `<managed-bean>` declarations and navigation rule outcome autocomplete (`action="..."`) from XML configuration files.
- [ ] **Custom Composite Component Support (`<cc:attribute>`)**: Enhanced auto-complete, diagnostics, and hover documentation for custom composite component attributes and metadata across project namespaces.
