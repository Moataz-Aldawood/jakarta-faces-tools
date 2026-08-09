const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function cleanHtml(html, firstParagraphOnly = false) {
    if (!html) return '';
    let text = html
        .replace(/<!\[CDATA\[/gi, '')
        .replace(/\]\]>/gi, '')
        .replace(/&lt;p&gt;|&lt;br\s*\/?&gt;|<p>|<br\s*\/?>/gi, '\n\n')
        .replace(/&lt;\/p&gt;|<\/p>/gi, '')
        .replace(/&lt;ul&gt;|&lt;\/ul&gt;|&lt;ol&gt;|&lt;\/ol&gt;|<ul>|<\/ul>|<ol>|<\/ol>/gi, '\n\n')
        .replace(/&lt;li&gt;|<li>/gi, '\n- ')
        .replace(/&lt;\/li&gt;|<\/li>/gi, '')
        .replace(/&lt;strong&gt;|&lt;\/strong&gt;|&lt;b&gt;|&lt;\/b&gt;|<strong>|<\/strong>|<b>|<\/b>/gi, '**')
        .replace(/&lt;code&gt;|&lt;pre&gt;|<code>|<pre>/gi, '`')
        .replace(/&lt;\/code&gt;|&lt;\/pre&gt;|<\/code>|<\/pre>/gi, '`')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/<\/?(div|span|a|h[1-6]|table|tr|td|th|tbody|thead|dl|dt|dd)[^>]*>/gi, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/ \n/g, '\n')
        .replace(/\n \n/g, '\n\n')
        .replace(/\n\n+/g, '\n\n')
        .trim();
        
    if (firstParagraphOnly) {
        text = text.split('\n\n')[0].replace(/\n/g, ' ').trim();
    }
    
    return text;
}

const url = 'https://repo1.maven.org/maven2/org/primefaces/primefaces/15.0.17/primefaces-15.0.17.jar';
const zipName = path.join(__dirname, 'primefaces.zip');
const extractDir = 'primefaces_extracted';

console.log('Downloading PrimeFaces 15.0.17 JAR...');
execSync(`powershell -Command "Invoke-WebRequest -Uri '${url}' -OutFile '${zipName}'"`, { stdio: 'inherit' });

console.log('Extracting JAR...');
const targetXml1 = 'META-INF/primefaces-p.taglib.xml';
const targetXml2 = 'META-INF/primefaces.taglib.xml';
let xmlContent = '';

try {
    execSync(`tar -xf ${path.basename(zipName)} ${targetXml1}`, { cwd: __dirname });
    xmlContent = fs.readFileSync(path.join(__dirname, 'META-INF', 'primefaces-p.taglib.xml'), 'utf8');
} catch (e1) {
    try {
        execSync(`tar -xf ${path.basename(zipName)} ${targetXml2}`, { cwd: __dirname });
        xmlContent = fs.readFileSync(path.join(__dirname, 'META-INF', 'primefaces.taglib.xml'), 'utf8');
    } catch (e2) {
        console.error('Could not find PrimeFaces taglib XML!');
        process.exit(1);
    }
}
fs.rmSync(path.join(__dirname, 'META-INF'), { recursive: true, force: true });

console.log('Parsing XML...');
const catalog = {};
const tagRegex = /<tag>([\s\S]*?)<\/tag>/g;
const nameRegex = /<tag-name>(.*?)<\/tag-name>/;
const descRegex = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/;
const fallbackDescRegex = /<description>([\s\S]*?)<\/description>/;

const attrRegex = /<attribute>([\s\S]*?)<\/attribute>/g;
const attrNameRegex = /<name>(.*?)<\/name>/;
const attrTypeRegex = /<type>(.*?)<\/type>/;
const attrRequiredRegex = /<required>(.*?)<\/required>/;
const attrDefaultValueRegex = /<default-value><!\[CDATA\[([\s\S]*?)\]\]><\/default-value>|<default-value>(.*?)<\/default-value>/;
const attrMethodSigRegex = /<method-signature><!\[CDATA\[([\s\S]*?)\]\]><\/method-signature>|<method-signature>(.*?)<\/method-signature>/;

let tagMatch;
let tagCount = 0;
while ((tagMatch = tagRegex.exec(xmlContent)) !== null) {
    const tagContent = tagMatch[1];
    
    const nameM = nameRegex.exec(tagContent);
    if (!nameM) continue;
    const tagName = nameM[1].trim();
    
    let descM = descRegex.exec(tagContent) || fallbackDescRegex.exec(tagContent);
    let desc = descM ? cleanHtml(descM[1]) : `PrimeFaces tag p:${tagName}`;

    const attributes = [];
    let attrMatch;
    while ((attrMatch = attrRegex.exec(tagContent)) !== null) {
        const attrContent = attrMatch[1];
        const aNameM = attrNameRegex.exec(attrContent);
        if (!aNameM) continue;
        
        let aDescM = descRegex.exec(attrContent) || fallbackDescRegex.exec(attrContent);
        let aDesc = aDescM ? cleanHtml(aDescM[1]) : '';
        
        const aTypeM = attrTypeRegex.exec(attrContent);
        const aType = aTypeM ? aTypeM[1].trim() : 'String';

        const aReqM = attrRequiredRegex.exec(attrContent);
        const aReq = aReqM ? aReqM[1].trim() === 'true' : false;

        const aDefM = attrDefaultValueRegex.exec(attrContent);
        const aDef = aDefM ? (aDefM[1] || aDefM[2]).trim() : undefined;

        const aMethM = attrMethodSigRegex.exec(attrContent);
        const aMeth = aMethM ? (aMethM[1] || aMethM[2]).trim() : undefined;

        const attrObj = {
            name: aNameM[1].trim(),
            description: aDesc,
            type: aType
        };
        if (aReq) attrObj.required = true;
        if (aDef) attrObj.defaultValue = aDef;
        if (aMeth) attrObj.methodSignature = aMeth;

        attributes.push(attrObj);
    }

    catalog[`p:${tagName}`] = {
        name: `p:${tagName}`,
        description: desc,
        attributes: attributes
    };
    tagCount++;
}

console.log(`Parsed ${tagCount} PrimeFaces tags.`);

let outContent = `import { JsfTag } from './jsfCatalog';\n\nexport const PRIMEFACES_VERSION = '15.0.17';\nexport const PRIMEFACES_CATALOG: Record<string, JsfTag> = `;
outContent += JSON.stringify(catalog, null, 4) + ';\n';

fs.writeFileSync(path.join(__dirname, 'primefacesCatalog.ts'), outContent);
console.log('primefacesCatalog.ts generated successfully.');

// Cleanup
fs.unlinkSync(zipName);
console.log('Cleanup done.');
