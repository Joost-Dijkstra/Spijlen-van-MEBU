Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

folder = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run "cmd /c cd /d """ & folder & """ && ""Spijlzoeker stoppen.cmd""", 0, False
