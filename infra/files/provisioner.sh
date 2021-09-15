#! /bin/bash

# install dev tools so we can compile a package ourselves
yum groupinstall -y 'Development Tools'

# make a bash profile
touch ~/.bash_profile

# install node version manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
echo "export NVM_DIR=~/.nvm" >> ~/.bash_profile
echo "source /.nvm/nvm.sh" >> ~/.bash_profile

# install node
nvm install v14.17.1
node -e "console.log('Running Node.js ' + process.version)"

# go to our app directory
cd /osc-ws-mux
# try to install all the dependencies - this will probably fail on ws
npm install
# install ws (websocket library) from source because this AMI doesn't have glibc 2.28...
npm install ws --build-from-source

# run app
npm run serve &

# also run webserver with webpage for testing websocket
cd examples
python -m SimpleHTTPServer 80 &