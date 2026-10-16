using System;
using System.IO;
using System.Diagnostics;
using System.Net;
using System.Threading;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;

class Launcher {
 static string Root=AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
 static string Data=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"BlueprintStudio");
 static string Node=Path.Combine(Root,"runtime","node.exe");
 static JavaScriptSerializer Json=new JavaScriptSerializer();
 static Dictionary<string,object> Status(int port) {
  try {var req=(HttpWebRequest)WebRequest.Create("http://127.0.0.1:"+port+"/api/status");req.Timeout=500;req.ReadWriteTimeout=500;req.Proxy=null;
   using(var response=req.GetResponse())using(var reader=new StreamReader(response.GetResponseStream()))return Json.Deserialize<Dictionary<string,object>>(reader.ReadToEnd());
  } catch{return null;}
 }
 static bool Own(Dictionary<string,object> status) {return status!=null&&status.ContainsKey("root")&&String.Equals(Path.GetFullPath((string)status["root"]).TrimEnd('\\','/'),Root,StringComparison.OrdinalIgnoreCase);}
 static void Stop() {
  // Match the exact private runtime path: never kill another project's Node.
  foreach(var p in Process.GetProcessesByName("node"))try {
   if(String.Equals(p.MainModule.FileName,Node,StringComparison.OrdinalIgnoreCase)){p.Kill();p.WaitForExit(10000);}
  }catch{}finally{p.Dispose();}
 }
 [STAThread] static int Main(string[] args) {
  bool stop=Array.IndexOf(args,"--stop")>=0,quiet=Array.IndexOf(args,"--quiet")>=0,noBrowser=Array.IndexOf(args,"--no-browser")>=0;
  string key;using(var sha=SHA256.Create())key=BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Root))).Replace("-","");
  using(var mutex=new Mutex(false,"Local\\BlueprintStudio-"+key)) {
   bool locked=false;try {
    try {locked=mutex.WaitOne(65000);}catch(AbandonedMutexException){locked=true;}
    if(!locked)throw new Exception("Another Blueprint Studio launch is still starting. Please try again shortly.");
    if(stop){Stop();return 0;}
    if(!File.Exists(Node))throw new Exception("The bundled runtime is missing. Run the Blueprint Studio installer again.");
    Directory.CreateDirectory(Data);Directory.CreateDirectory(Path.Combine(Data,"logs"));
    int chosen=0;
    for(int port=38799;port<=38819;port++){var status=Status(port);if(Own(status)){chosen=port;break;}}
    if(chosen==0){
     for(int port=38799;port<=38819;port++)try {var listener=new System.Net.Sockets.TcpListener(IPAddress.Loopback,port);listener.Start();listener.Stop();chosen=port;break;}catch{}
     if(chosen==0)throw new Exception("No free local port was found between 38799 and 38819.");
     var info=new ProcessStartInfo(Node,"\""+Path.Combine(Root,"installer","desktop-server.mjs")+"\"");
     info.WorkingDirectory=Root;info.UseShellExecute=false;info.CreateNoWindow=true;info.WindowStyle=ProcessWindowStyle.Hidden;
     info.EnvironmentVariables["PORT"]=chosen.ToString();
     if(String.IsNullOrEmpty(Environment.GetEnvironmentVariable("SM_WORK_ROOT")))info.EnvironmentVariables["SM_WORK_ROOT"]=Path.Combine(Data,"workspace");
     if(String.IsNullOrEmpty(Environment.GetEnvironmentVariable("SM_CONFIG_FILE")))info.EnvironmentVariables["SM_CONFIG_FILE"]=Path.Combine(Data,"studio.config.json");
     info.EnvironmentVariables["PLAYWRIGHT_BROWSERS_PATH"]=Path.Combine(Root,"browsers");
     info.EnvironmentVariables["SM_DESKTOP_LOG"]=Path.Combine(Data,"logs","desktop-server.log");
     using(var process=Process.Start(info)){
      bool ready=false;for(int i=0;i<120;i++){if(Own(Status(chosen))){ready=true;break;}if(process.HasExited)break;Thread.Sleep(250);}
      if(!ready){if(!process.HasExited){process.Kill();process.WaitForExit(5000);}string log=info.EnvironmentVariables["SM_DESKTOP_LOG"];string detail=File.Exists(log)?File.ReadAllText(log):"No startup log was written.";if(detail.Length>2500)detail=detail.Substring(detail.Length-2500);throw new Exception("Blueprint Studio could not start.\n\n"+detail+"\n\nConfiguration: "+Path.Combine(Data,"studio.config.json"));}
     }
    }
    if(!noBrowser)Process.Start(new ProcessStartInfo("http://127.0.0.1:"+chosen){UseShellExecute=true});
    return 0;
   }catch(Exception e){if(!quiet)MessageBox.Show(e.Message,"Blueprint Studio",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}
   finally{if(locked)mutex.ReleaseMutex();}
  }
 }
}
