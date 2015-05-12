// These will be initialized later
var recognizer, recorder, callbackManager, audioContext, outputContainer;
// Only when both recorder and recognizer do we have a ready application
var recorderReady = recognizerReady = false;

var talkButton = document.getElementById('talkButton'),
  infoButton = document.getElementById('infoButton'),
  bubbles = document.getElementById('bubbles'),
  waitingMsg = '<i>Waiting...</i>';

// A convenience function to post a message to the recognizer and associate
// a callback to its response
function postRecognizerJob(message, callback) {
  var msg = message || {};
  if (callbackManager) msg.callbackId = callbackManager.add(callback);
  if (recognizer) recognizer.postMessage(msg);
};

// This function initializes an instance of the recorder
// it posts a message right away and calls onReady when it
// is ready so that onmessage can be properly set
function spawnWorker(workerURL, onReady) {
  recognizer = new Worker(workerURL);
  recognizer.onmessage = function(event) {
    onReady(recognizer);
  };
  recognizer.postMessage('');
};

// This updates the UI when the app might get ready
// Only when both recorder and recognizer are ready do we enable the buttons
function updateUI() {
  //if (recorderReady && recognizerReady)
};

// Callback function once the user authorises access to the microphone
// in it, we instanciate the recorder
function startUserMedia(stream) {
  var input = audioContext.createMediaStreamSource(stream);
  // Firefox hack https://support.mozilla.org/en-US/questions/984179
  window.firefox_audio_hack = input;
  var audioRecorderConfig = {
    errorCallback: function(x) {
      console.log("Error from recorder: " + x);
    },
    outputBufferLength: 2000
  };
  recorder = new AudioRecorder(input, audioRecorderConfig);
  // If a recognizer is ready, we pass it to the recorder
  if (recognizer) recorder.consumers = [recognizer];
  recorderReady = true;
  updateUI();
  console.log("Audio recorder ready");
};

// This starts recording. We first need to get the id of the grammar to use
var startRecording = function() {
  var bubble = addBubble('piggy');
  bubble.innerHTML = waitingMsg;
  if (recorder && recorder.start()) talkButton.className = 'inProgress';
};

// Stops recording
var stopRecording = function() {
  if (recorder) recorder.stop();
};

// Called once the recognizer is ready
// We then add the grammars to the input select tag and update the UI
var recognizerReady = function() {
  recognizerReady = true;
  updateUI();
  console.log("Recognizer ready");
};

// This initializes the recognizer. When it calls back, we add words
var initRecognizer = function() {
  // You can pass parameters to the recognizer, such as : {command: 'initialize', data: [["-hmm", "my_model"], ["-fwdflat", "no"]]}
  postRecognizerJob({
      command: 'initialize',
      data: [
        ['-hhm', 'piggy'],
        ['-dict', 'piggy.dic'],
        ['-lm', 'piggy.lm.DMP']
      ]
    },
    function() {
      if (recorder) recorder.consumers = [recognizer];
    });
};

console.log("Initializing web audio and speech recognizer, waiting for approval to access the microphone");
callbackManager = new CallbackManager();
spawnWorker("js/recognizer.js", function(worker) {
  // This is the onmessage function, once the worker is fully loaded
  worker.onmessage = function(e) {
    // This is the case when we have a callback id to be called
    if (e.data.hasOwnProperty('id')) {
      var clb = callbackManager.get(e.data['id']);
      var data = {};
      if (e.data.hasOwnProperty('data')) data = e.data.data;
      if (clb) clb(data);
    }
    // This is a case when the recognizer has a new hypothesis
    if (e.data.hasOwnProperty('hyp')) {
      bubbles.lastChild.innerHTML = e.data.hyp? e.data.hyp.charAt(0).toUpperCase() + e.data.hyp.slice(1) + '.' : waitingMsg;
      if (e.data.hasOwnProperty('final')) {
        if (!e.data.hyp) bubbles.removeChild(bubbles.lastChild);
        talkButton.className = 'waiting';
      }
    }
    // This is the case when we have an error
    if (e.data.hasOwnProperty('status') && (e.data.status == "error")) {
      console.log("Error in " + e.data.command + " with code " + JSON.stringify(e.data.code));
    }
  };
  // Once the worker is fully loaded, we can call the initialize function
  initRecognizer();
});

// The following is to initialize Web Audio
try {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  window.URL = window.URL || window.webkitURL;
  audioContext = new AudioContext();
} catch (e) {
  console.log("Error initializing Web Audio browser");
}

if (navigator.getUserMedia) navigator.getUserMedia({
    audio: true
  }, startUserMedia,
  function(e) {
    console.log("No live audio input in this browser");
  });
else console.log("No web audio support in this browser");

// Wiring JavaScript to the UI
function addBubble(type) {
  var bubble = document.createElement('div');
  bubble.className = 'bubble ' + type;
  bubbles.appendChild(bubble);
  return bubble;
}

talkButton.onclick = function() {
  if (this.className == 'waiting') startRecording();
  else if (this.className == 'inProgress') stopRecording();
};

infoButton.onclick = function() {
  if (talkButton.className == 'waiting') {
    var bubble = addBubble('info');
    bubble.innerHTML = 'Powered by <a href="https://github.com/syl22-00/pocketsphinx.js">Pocketsphinx.js</a>.<br><br>\
      Icon made by <a href="http://www.freepik.com" title="Freepik">Freepik</a> from <a href="http://www.flaticon.com" title="Flaticon">www.flaticon.com</a> is licensed under <a href="http://creativecommons.org/licenses/by/3.0/" title="Creative Commons BY 3.0">CC BY 3.0</a>.';
  }
};