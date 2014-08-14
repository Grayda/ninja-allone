exports.menu = {
  "contents":[
    { "type": "paragraph", "text": "Welcome to the Hello World driver. Enter some text to echo back."},
    { "type": "input_field_text", "field_name": "hello_text", "value": "", "label": "Some Text", "placeholder": "Hellooooo!", "required": true},
    { "type": "submit", "name": "Echo back to me", "rpc_method": "echo" },
  ]
};

exports.echo = {
  "contents":[
    { "type": "paragraph", "text": "You said"},
  ]
};