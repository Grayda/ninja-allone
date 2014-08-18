ninja-allone
============

Ninja Blocks driver for the Orvibo AllOne IR blaster. Control your TV, air conditioner, S10 sockets and other IR goodies from your Ninja Block!

Installation
============

 1. Set up your AllOne and any S10 sockets you have via the WiWo / SmartPoint apps (this driver assumes you're all set up and ready to go)
 2. SSH into your Ninja Block and head to your driver directory
 3. Run this command: `git clone http://github.com/Grayda/ninja-allone && cd ninja-allone && npm install && restartninja`
 4. Reload your dashboard and any AllOne devices detected will show up.
 5. Type `LEARN` (must be in uppercase) into the text box and press "Set Text". This will put the AllOne into learning mode (solid red light)
 6. Grab your remote of choice and press a button. Keep the press short if possible
 7. `LEARN` will disappear from the box and be replaced with a long string of hex. **This is your IR code**. Use it in your rules and such. Save it somewhere because otherwise you'll need to program it again!
 8. S10 sockets will appear as relay devices. Toggle the switch to turn them off and on, or use the rules page to control them via other means
 9. The button on top of the Orvibo AllOne will appear as a separate widget on the dashboard. Use the rules page to do stuff when the button is pressed!
 
Using with rules
================

If you wish to use run rules when you press the physical button on top of the AllOne, go to http://a.ninja.is/you and find the rule element called [your AllOne's name]button. It's that simple!

Please note that it's not possible to control your Ninja Block using an IR remote. It may come at a later time, but for now it's technically not possible.

To-Do
=====

~~* Allow saving and replay of learned IR codes (in progress)~~ Not possible due to limitations in the 433mhz widget, but research still ongoing
* Test with more than one AllOne
~~* Roll the ninja-orvibo code into this for maximum socketness and blastering!~~
* Write an emulator for this device (?)

Supporting development
======================

I was born and raised on the open source software movement. If you like what I do, consider donating code, hardware or a few bucks to cover costs / Redbull. PayPal donations welcome at grayda [a@t] solidinc [dot.org], code forks and pull requests strongly encouraged and if you have an Orvibo S20 socket, please donate Wireshark / tcpdump / Shark for Root files if you can!
