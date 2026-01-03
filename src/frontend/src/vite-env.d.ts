/// <reference types="vite/client" />

// Allow importing CSS files
declare module '*.css' {
  const content: string;
  export default content;
}

// Allow importing CSS modules
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
