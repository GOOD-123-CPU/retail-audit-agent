Option Explicit

Dim shell, fso, projectRoot, command

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
projectRoot = fso.GetParentFolderName(WScript.ScriptFullName)

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & _
  projectRoot & "\scripts\start-system.ps1"""

shell.Run command, 0, False
