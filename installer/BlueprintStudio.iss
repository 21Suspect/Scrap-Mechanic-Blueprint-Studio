#ifndef Payload
 #error Pass /DPayload=absolute-path-to-payload
#endif
#ifndef ReleaseVersion
 #define ReleaseVersion "0.2.0"
#endif
[Setup]
AppId={{EE415868-835F-47E5-B737-2300241D9A31}
AppName=Blueprint Studio
AppVersion={#ReleaseVersion}
AppPublisher=21Suspect
AppPublisherURL=https://github.com/21Suspect/Scrap-Mechanic-Blueprint-Studio
DefaultDirName={localappdata}\Programs\BlueprintStudio
DefaultGroupName=Blueprint Studio
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableWelcomePage=yes
DisableReadyPage=no
OutputBaseFilename=BlueprintStudio-Setup-{#ReleaseVersion}
OutputDir=..\dist
Compression=lzma2/fast
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\BlueprintStudio.exe
CloseApplications=no
SetupLogging=yes
[Files]
Source: "{#Payload}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{userdesktop}\Blueprint Studio"; Filename: "{app}\BlueprintStudio.exe"; WorkingDir: "{app}"
Name: "{group}\Blueprint Studio"; Filename: "{app}\BlueprintStudio.exe"; WorkingDir: "{app}"
Name: "{group}\Stop Blueprint Studio"; Filename: "{app}\BlueprintStudio.exe"; Parameters: "--stop"; WorkingDir: "{app}"
Name: "{group}\Uninstall Blueprint Studio"; Filename: "{uninstallexe}"
[Run]
Filename: "{app}\BlueprintStudio.exe"; Description: "Open Blueprint Studio"; Flags: nowait postinstall skipifsilent
[UninstallRun]
Filename: "{app}\BlueprintStudio.exe"; Parameters: "--stop --quiet"; Flags: runhidden waituntilterminated; RunOnceId: "StopStudio"
[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var ResultCode: Integer;
begin
 Result := '';
 if FileExists(ExpandConstant('{app}\BlueprintStudio.exe')) then
  if not Exec(ExpandConstant('{app}\BlueprintStudio.exe'), '--stop --quiet', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
   Result := 'Could not stop the existing Blueprint Studio. Close it before updating.';
end;
