//simple scriptloader, thanks https://usefulangle.com/post/343/javascript-load-multiple-script-by-order
let loadScript = (url) => {
    return new Promise ( (resolve, reject) => {
      let script = document.createElement('script');
      script.src = url;
      script.async = false;
      script.onload = () => {
        resolve(url);
      };
      script.onerror = () => {
        reject(url);
      };
      document.body.appendChild(script);
    });
  }
  
  
  let loadScripts = (urls) => {
    return new Promise ( (resolve, reject) => {

      let promises = [];
    
      for (let i = 0, l = urls.length - 1; i < l; i++) {
        promises.push(loadScript(urls[i]));
      }
      
      Promise.all(promises)
      .then( () => {
          loadScript(urls[urls.length - 1])
          .then( () => {
            console.log('all scripts loaded');
            resolve();
          })
          .catch( () => {
            console.log('main script not loaded');
            reject();
          });
      })
      .catch ((script) => {
        console.log(script + ' failed to load');
        reject();
      });
    })
}
 
const scriptURLs = [
    'scripts/Indicator.js',
    'scripts/main.js'
];
  
  

loadScripts(scriptURLs);