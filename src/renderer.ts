import prompt from "electron-prompt"

// The reactor's data
import { Dataset, Dataseries, Datapoint } from "./models/data.model";

// @ts-ignore
import reactor_data from './dist/reactor.data';

// Serial Connection
// @ts-ignore
import * as serial from './dist/serial';
// @ts-ignore
import { SerialStatus, SerialBinding } from "./dist/models/serial.model"
import SerialPort from 'serialport';  // Type

// UI Elements
// @ts-ignore
import * as status_indicator from './dist/window.statuses';
// @ts-ignore
import * as notebook from "./dist/window.notebook";
// console.log(notebook)
// @ts-ignore
import * as charts from "./dist/window.charts";


// IIFE To initialize the window
function init() {
	// Status Indicators
	status_indicator.update(SerialStatus.UNDETERMINED);
	
	// Charts
	charts.init_charts();
	charts.init_selector(reactor_data.datasets);
	charts.primary.select(reactor_data.datasets[0]);
	notebook.append("UBC MARS COLONY\nReactor UI Initialized Successfully\n");

	// Serial
	serial.init()
	serial.bind(status_indicator.update, SerialBinding.STATUS)
	serial.bind(reactor_data.update,     SerialBinding.DATA)
	serial.bind(charts.primary.update,   SerialBinding.DATA)
}

function loop () {
	serial.run()
}


// INIT & LOOP FUNCTION IMPLEMENTATION
// IIFE that calls the init function once as soon as this file loads
$(init);  
// Calls the loop function routinely after the window completely loads
$(document).ready(() => setInterval(loop, 500));

function routine_connect_toggle()
{
	if (serial.connected())
		routine_disconnect();
	else
		routine_connect();
}

function routine_connect()
{
	if (serial.open())
	{
		notebook.append("Reactor Connection Opened!");
	}
	else
	{
		notebook.append("Reactor Connection Failed", notebook.ERROR);
	}
}

function routine_disconnect()
{
	serial.close();
	status_indicator.update(status_indicator.DISCONNECTED);
	notebook.append("Reactor Connection Terminated");
}

function routine_start()
{
	notebook.append("Start Routine Not Implemented", notebook.ERROR);
}

function routine_stop()
{
	notebook.append("Stop Routine Not Implemented", notebook.ERROR);
}

function routine_manual()
{

	if(serial.connected()) {
		prompt({
			title: 'Command prompt',
			label: 'Command:',
			type: 'input'
		})
		.then((command) => {
			if(!serial.sendManualCommandToReactor(command)){
			 notebook.append("Invaild command", notebook.WARNING);
			}
		})
		.catch(console.error);
	} 
	else {
		notebook.append("Reactor not connected.", notebook.ERROR);
	}
}
