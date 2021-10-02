import SerialPort, { parsers } from "serialport";
import { Dataset, Dataseries, Datapoint, name_from_id } from "./models/data.model";
import { Bytestream, SerialStatus, SerialReceiveCallback,
         SerialBinding, StatusBinding, DataBinding, BindingStore} from "./models/serial.model";

// All bindings are stored here:
const bindings: BindingStore = {
	status: [],
	data: []
};

// This contains information for the Serial port we attach/connect to.
let port: SerialPort = null;
// We need some default behaviour whenever some data comes over the serial connection;
const DEFAULT_PORT_CB: SerialReceiveCallback = (bytestream: Bytestream) =>
{
	if (!bytestream)  // The bytestream isn't defined, so exit immediately
		return;

	let parsed_dataset: Dataset;
	try
	{
		parsed_dataset = parse_reactor_data(bytestream)
	}
	catch (e)
	{
		console.log("Reactor Data Parse Failed with trace: ", e)
		return;
	}
	if (!parsed_dataset)  // Something went wrong in the parse routine
		return;       // that wasn't caught; exit now

	parsed_dataset.name = name_from_id(parsed_dataset.id)
	for (let series of parsed_dataset.series)
		series.name = name_from_id(parsed_dataset.id, series.id);

	bindings.data.forEach((cb: DataBinding) => 
		cb(parsed_dataset));
};

export function init()
{
	// Stub
}

/* Author: Thomas Richmond
 * Purpose: Binds a function call to a serial event
 *          specified by SerialBinding. The function
 *          will be called asynchronously whenever the
 *	    event fires.
 * Parameter: cb [Function] - A callback function to run.
 *			      Function must conform to specification
 *			      as dictated by the binding type; see below.
 *            bind_id [SerialBinding] - The type of binding:
 *  					 * STATUS binding fires every time the 
 *					   serial status changes;
 *                                         function must conform to StatusBinding type.
 *					 * DATA binding fires whenever new reactor data
 *					   is received;
 *					   function must conform to DataBinding type.
 */
export function bind(cb: Function, bind_id: SerialBinding)
{
	// When binding a function, we need to make sure it gets
	// put into the correct binding array. This switch case
	// ensures that happens.
	switch (bind_id) 
	{
		case SerialBinding.STATUS: 
			bindings.status.push(cb as StatusBinding); 
			break;
		case SerialBinding.DATA:
			bindings.data.push(cb as DataBinding);
			break;
	}
}

/* Author: Thomas Richmond
 * Purpose: Runs the looping logic of the serial system.
 *          For the most part, Serial functionality is async,
 *          but this function looks for serial connections in
 *	    the event that we don't have a serial connection.
 */
export function run()
{
	if (connected())
		return;  // Everything is fine!
	
	// At this point, we know we are not connected to any ports.
	// Let's see if we can attach to one...
	// @ts-ignore  (Usual type PortInfo doesn't seem to work;
	//              use ts-ignore to avoid 'implicit any' error)

	SerialPort.list().then((ports: Array<any>) =>
	{
		if (ports.length === 0)
		{
			bindings.status.forEach((cb: StatusBinding) =>
				cb(SerialStatus.SCANNING));
		}
		else 
		{
			attach(ports[0].path, DEFAULT_PORT_CB);
			bindings.status.forEach((cb: StatusBinding) =>
				cb(SerialStatus.ATTACHED));
		}
	}).catch(alert);  // Print out the error in an alert box; //TODO change this
}

/* Author: Thomas Richmond
 * Purpose: When a serial port is detected we can "lock on" to it. We call this attaching.
 *          However, NO DATA TRANSFER WILL OCCUR WITH ATTACHING. We must use the open()
 *          function to begin data transfer.
 * Parameters: path [string] - The path to the Serial port. Examples:
 *                               For windows: COM3
 *                               For Linux:   dev/ttyACM0
 *             on_receive [SerialReceiveCallback] - A function which fires whenever
 *                                                  serial data is received from the reactor.
 */
function attach(path: string, on_receive: SerialReceiveCallback)
{
	// @ts-ignore
	port = new SerialPort(path, {
		baudRate: 9600,  
		autoOpen: false	    // Wait for the user to connect
	});

	const ReadLine =  require('@serialport/parser-readline')
	const parser = port.pipe(new ReadLine())
	parser.on('data', console.log)
	// port.pipe(
	// 	new SerialPort.parsers.Ready({delimiter: 'RSIP>>'}));
	// parser.on('ready', () => console.log('Data incoming'));
	// parser.on('data', on_receive);
}

/* Author: Thomas Richmond
 * Purpose: Starts Serial communications between the reactor and GUI.
 *          There must be an attached serial port for this function to work;
 *          see function attach()
 */
export function open(): boolean
{
	if (port == null)
		return false
	
	// TODO implement async handling for port opening successes and errors
	port.open();
	bindings.status.forEach((cb: StatusBinding) => 
		cb(SerialStatus.CONNECTED))
	
	return true;
}

/* Author: Thomas Richmond
 * Purpose: Opposite of open(); closes the serial connection between reactor and GUI.
 */
export function close()
{
	if (port == null)  // Port is assumed to be closed if null.
		return;
		
	port.close();
	port = null;
}

/* Author: Thomas Richmond
 * Purpose: Boolean check to see if we are connected (i.e. serial connection is open)
 *          to a reactor. Does NOT check if we are attached.
 * Returns: True if there is an open connection; false otherwise.
 */
export function connected(): boolean
{
	return  port == null  ? false :
		!port.isOpen  ? false :
		true;
}

/* Author: Thomas Richmond
 * Purpose: Parses a bytestream under the assumption that there is reactor data
 *          contained within it. Bytestream must comply with Mars Colony Standard.
 * Parameter: bytestream - A bytestream received from the reactor. It is assumed
 *                         that the bytestream is valid; validations should occur 
 *                         before calling this function.
 * Returns: A Dataset containing the reactor data.
 */
function parse_reactor_data(bytestream: Bytestream): Dataset
{
	bytestream = bytestream.slice(6);  // Take off the indicator "RSIP>>"

	// Check a few things to make sure the message is valid:
	if (bytestream[3] === 0)  // This indicates an invalid length (zero)
		return;
	
	// Generate a buffer to store the new data
	let dataset: Dataset = {
		name: null,		// Don't need to define this here
		id: bytestream[1],
		units: null,		// Don't need to define this here
		series: []
	};

	// Iterate over the bytestream and extract the data it contains.
	for (let i = 0; i < bytestream[2]; i++)
	{
		// Get the next datapoint in the bytestream.
		// Use some math to iterate over each frame.
		let buffer = bytestream.slice(4 + i * bytestream[3], 4 + (i + 1) * bytestream[3]);
		// console.log(buffer);
		if (buffer.length === 0)
			return;

		// Need to extract floating point values within the stream
		const view = new DataView(new ArrayBuffer(bytestream[3]));
		for (let j = 0; j < bytestream[3]; j++)
			view.setInt8(j, buffer[j]);
			
		// console.log(view);
		const next_ser_id = view.getInt16(0, true);  // Get the ID for the series
		let series_index = dataset.series.findIndex((s: Dataseries) => s.id === next_ser_id);
		if (series_index === -1)
		{
			series_index = dataset.series.length;
			dataset.series[series_index] = {
				name: null,
				id: next_ser_id,
				data: []
			};
		}
		
		dataset.series[series_index].data.push({
			time: view.getInt32(2, true) / 1000.0,  // Convert milliseconds to seconds
			value: view.getFloat32(6, true)
		});
	}
	// console.log(datapoints);
	return dataset;
}

