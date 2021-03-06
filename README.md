# OSC Websocket Multiplexer

A naïve node JS application which can receive OSC messages from a number of sources, aggregates messages in memory, and broadcasts the data at a specified interval. 

When many messages are sent to the same OSC address between broadcast intervals, only the latest message is broadcast for that address.

The multiplexed data is broadcast in two formats:

- as a JSON object via Websocket to any active connected devices
- via OSC to a specified host/port (technically this broadcast format can't multiplex messages, but this single OSC channel will broadcast messages from all the input sources)

## Usage

### Running the application

To run this application on your local machine, you must have [**Node 14+**](https://nodejs.org/en/download/) installed.
This has been tested with **v14.17.1, v16.10.0**.

You'll also need to install the dependencies. In the root directory of this project, run

```bash
$ npm install
```

which should create a `node_modules` directory. You should now have everything you need to run the application:

```bash
$ ADMIN_PAGE=true npm run serve
```

The `ADMIN_PAGE=true` environment variable can be useful for those who want a GUI to preview the incoming data and control some features. You can also do `npm run serve` without setting the environment variable.
You should see output that looks something like:

```
Setting up UDP and WSS Servers for Broadcast
Listening for OSC over UDP port 57121
Setting up Simple HTTP Server
Simple HTTP Server running at localhost:8002
udpReady: true | websocketReady: true | timeWaiting < 10ms
When OSC received, will re-broadcast data...
...via OSC to 0.0.0.0:9001 via local UDP port 57122
...via Websockets to connected clients over port 8080
```

If you ever need to kill the application, you can do so by returning to the terminal window and jamming on `Ctrl + c`.


### Sending OSC data to the application

Now you should be able to send OSC data to `localhost:57121` from your own machine, or (given permissive enough security on your network/system/firewalls) to `{your local IP address}:57121` from another device connected to your local network.

The application doesn't log the incoming messages, so there isn't any feedback that OSC messages are received without trying to read the multiplexed data from the application. The next step talks about how to do this.

### Reading data from the application ...using the Admin Page

The easiest way to validate everything's working is with the Admin Webpage.
Given you're running the application with the `ADMIN_PAGE=true` environment variable as shown in the example above, you should be able to navigate to `http://localhost:8002` in your web browser.

Now when OSC messages are sent to port `57121`, this webpage should print them out.

From this page you can:

- Initiate recordings of data streams (recording files stored as JSON in the `recordings/` directory)
- Trigger these recordings (causing them to be broadcast to all consumers)
- Configure broadcasting/relaying the OSC data to another address and port, in addition to the websocket broadcast. This could be useful if you have non-web consumers that happen to accept OSC.

### Reading data from the application ...using Websockets

If you've got the application running, your machine will now be acting as a websocket server (accessible on `localhost:8080`, by default).

You should be able to use your client of choice to perform the websocket handshake.

### Reading data from the application ...using OSC

If you have a destination machine where you wish to receive the "multiplexed" OSC messages, this can be configured before running the application (shown in the below example), or after by using the Admin Page as mentioned above.

In the index.js file, you can pass these to the Broadcaster.

```js
const broadcaster = new Broadcaster({
    oscDestinationAddress: '0.0.0.0',
    oscDestinationPort: '9001', // a port on the above address that wants to receive OSC messages
})
```

Now you can run the application with `$ npm run serve`.

### Deploying to the AWS Cloud (optional)

This repository contains Infrastructre As Code.
Using a tool called [Terraform](https://www.terraform.io/), you can deploy this all to the cloud.

To set up this infrastructure on your own AWS estate, you'll need:

- An AWS Account
- Programmatic Access Credentials configured as the default AWS credentials
- [Terraform version 1.0.6](https://releases.hashicorp.com/terraform/)

The configuration in this repository creates a small instance that AWS will charge you for monthly, with the cost being about $0.01 per hour. If you want something bigger and more performant (ergo more expensive), you will want to change the instance type in `infra/ec2.tf` from `t3.micro` to [something else](https://aws.amazon.com/ec2/instance-types/).

With terraform installed and available on your `$PATH`, you can navigate to the infra directory and initialise Terraform:

```bash
$ cd infra/
$ terraform init
```

One important step is to create a key that will help you unlock your virtual server later if you need to. We should do that now, because it needs to happen before the infrastructure gets created.

Please remember, we're in the `infra/` directory still.

```bash
ssh-keygen -N "" -t rsa -b 4096 -C "osc_ws_mux" -f ./osc_ws_mux_ssh_key
```

This will create a pair of keys inside of infra directory. They should not be shared or committed to this repository.

We must do one extra step, since we are constrained on the size of our application files because of our deployment/provisioning mechanism (at the time of writing):
If there have been changes to the `broadcasterClass.js` or `web/client.js` file, we must minify these files into `broadcasterClass-min.js` and `web/client-min.js` respectively.

Now you can "apply", which means preparing a plan of infrastructure changes you want to make, and confirming them by typing 'yes' at the prompt. We will also include an argument that passes in the public part of the key to your future virtual server:

```bash
$ terraform apply -var="public_key=$(head -n 1 ./osc_ws_mux_ssh_key.pub)"
```

Now you may need to wait for your infrastructure to be created, recreated, or provisioned... but in short order you should have an instance which should be available to the public for sending and receiving data (including the example webpage).

In future, this configuration should improve its security.

You can retreive the IP Address of the instance once it's created by running this in the `infra/` directory, which you can use as the destination host for your OSC messages, or for the example test page in the browser (`http://{ip address}/websocketClient.html`):

```bash
$ terraform show | grep -A 14 "aws_eip" | grep "public_ip[^a-z]"
```

If you wish to set a custom domain, like `mywebsite.com` or `myproject.mywebsite.com`, you can set up a new "A Record" with your DNS Provider, pointing to the above "Elastic" IP Address. The idea is this IP Address will not change between server rebuilds.

For troubleshooting and debugging the running server, you should be able to SSH into the virtual machine from within the `infra/` directory like this:

```bash
$ ssh -i ./osc_ws_mux_ssh_key ec2-user@ec2-{ip address but replace every . with a -}.eu-west-2.compute.amazonaws.com
```
