import {chromium} from 'playwright';

// Automated capture/import can use a browser already installed on the host.
export async function launchBrowser(options={}){
 const channels=process.env.SM_BROWSER_CHANNEL?[process.env.SM_BROWSER_CHANNEL]:['chrome','msedge',undefined];
 const errors=[];
 for(const channel of channels)try{return await chromium.launch({headless:true,...options,...(channel?{channel}:{})});}catch(e){errors.push(e.message);}
 throw Error('No automation browser could start. Install Chrome or Edge, or run npx playwright install chromium. '+errors.join('\n'));
}
