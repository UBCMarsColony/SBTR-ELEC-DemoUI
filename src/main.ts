import {app, BrowserWindow} from "electron";
const path = require('path')
const url = require('url')

let window: Electron.BrowserWindow = null;

// Wait until the app is ready
app.once('ready', () => {
	// Create a new window
	window = new BrowserWindow({
		// Set the initial width to 500px
		width: 1366,
		// Set the initial height to 400px
		height: 768,
		// set the title bar style
		titleBarStyle: 'hiddenInset',
		// set the background color to black
		backgroundColor: "#111",
		// Don't show the window until it's ready, this prevents any white flickering
		show: false
	})

	window.loadURL(path.join(__dirname, "../window.html"));
	// window.registerShortcut("CmdOrCtrl+C", () => {
		
	// });
  
  
	window.once('ready-to-show', () => {
		window.show();
	})  
})