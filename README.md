# babel-plugin-transform-es2015-modules-simple-amd

Limited AMD transformer for ECMAScript 2015 modules.

Converts this code:
```js
import x from '/path/to/x';
import y from '/path/to/y';
doSomething();
export default x + y;
```

Into this:
```js
define(['/path/to/x', '/path/to/y'], function (x, y) {
  doSomething();
  return x + y;
});
```

Other features (like ``import x as y from 'X'`` or ``import * from 'X'`` etc) aren't supported. Just ``import VARIABLE from 'PATH'``.

## Installation

```sh
$ npm install --save-dev babel-plugin-transform-es2015-modules-simple-amd
```

## Usage

### Via `.babelrc` (Recommended)

**.babelrc**

```json
{
  "plugins": ["transform-es2015-modules-simple-amd"]
}
```

### Via Node API

```javascript
require('babel').transform('code', {
  plugins: ['transform-es2015-modules-simple-amd']
});
```


Thanks to [RReverser](https://github.com/RReverser/babel-plugin-hello-world).
