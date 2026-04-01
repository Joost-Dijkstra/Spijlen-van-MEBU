Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

folder = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run "cmd /c cd /d """ & folder & """ && ""Spijlzoeker openen.cmd""", 0, False
