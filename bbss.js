let lastRender = 0;
let focusIndex = 0;
let nextWorldTick = 0;
let nextWeekStart = 0;
const worldTickIncrement = 10000; //time in a tay (1,000 paysContainer second)
const daysInWeek = 7;
const duesTickIncrement = worldTickIncrement * daysInWeek;
const resources = [];
const graphContext = document.getElementById('graph').getContext("2d");
const focusGraphContext = document.getElementById('focusGraph').getContext("2d");
const graphInfo = {};
const focusGraphInfo = {}
const currencySymbol = '&#165;';
let fullDrawThisFrame = true;

const gameInfo = {
  'maxValue': 100,
  'minValue': 20,
  'currency': 190,
  'income': 10,
  'snapshots': 30,
  'dues': null, //init this after resources
  'duesTicks': 0,
  'day': 0,
  'dayOfWeek': 0,
  'score': {
    'duesValue': 0
  },
  'allowGameOver': true, //for testing
  'play': true,
  'duesScore': 0,
  'offers': [],
  'offersState': 0 //0 - accept | 1 - reject | 2 - done
}


/*  - - - - - - - - - - - - - - - - initialize - - - - - - - - - - - - - - - - -  */
init(); //initialize
window.requestAnimationFrame(loop); //start loop

function init() { //one time setup of the new game
  graphInfo.width = $('#graph').innerWidth();
  graphInfo.height = $('#graph').innerHeight();
  graphInfo.rWidth = graphInfo.width / 7; //size and spacing to draw the resources on the graph
  graphInfo.rSpacing = graphInfo.rWidth / 7;

  focusGraphInfo.width = $('#focusGraph').innerWidth();
  focusGraphInfo.height = $('#focusGraph').innerHeight();
  focusGraphInfo.pX = focusGraphInfo.width / 20; //where to put the graph on the canvas
  focusGraphInfo.pY = focusGraphInfo.height / 10;
  focusGraphInfo.sX = focusGraphInfo.width * 9 / 10; //draw size
  focusGraphInfo.sY = focusGraphInfo.height * 4 / 5;
  focusGraphInfo.spacing = focusGraphInfo.sX / (gameInfo.snapshots - 1); //space between graph points

  $('#graph').attr("width", graphInfo.width); //need to set these to # values
  $('#graph').attr("height", graphInfo.height);
  $('#focusGraph').attr("width", focusGraphInfo.width);
  $('#focusGraph').attr("height", focusGraphInfo.height);

  resources.push(new resourceObj('#9A6324', `<i class="fas fa-dice-d20"></i>`));
  resources.push(new resourceObj('#3cb44b', `<i class="fas fa-tree"></i>`));
  resources.push(new resourceObj('#4363d8', `<i class="fas fa-ice-cream"></i>`));
  resources.push(new resourceObj('#f032e6', `<i class="fas fa-puzzle-piece"></i>`));
  resources.push(new resourceObj('#ff8874', `<i class="fas fa-robot"></i>`));
  resources.push(new resourceObj('#0ff', `<i class="fas fa-chess-pawn"></i>`));
  console.log(resources);
  gameInfo.dues = new duesObj();

  for (let i = 0; i < resources.length; i++) {
    $(`#icon${i}`).html(resources[i].icon); //add icons to the the graph's overlay
    $(`.r${i}`).css({
      'color': resources[i].color,
      'border-color': resources[i].color
    });
    $(`#icon${i}`).css({
      'color': resources[i].color
    });
    $(`#r${i}Button`).click(() => setFocus(i)); //register focus buttons
    $(`#r${i}Sell`).click(() => sell(i));
    $(`#r${i}Buy`).click(() => buy(i));
  }
  setFocus(0);

  $('#graph').on('mousedown', graphClicked);
  $('#payDues').click(() => payDues());
  $('#gameOverButton').click(() => location.reload());

  gameInfo.offers.push(new offerObj());
  gameInfo.offers.push(new offerObj());
  gameInfo.offers.push(new offerObj());
  gameInfo.offers.push(new offerObj());
  for (let i = 0; i < gameInfo.offers.length; i++) {
    $(`#offer${i}Button`).click(() => offerButtonPressed(i));
  }
  changeOfferState(0);
  nextWeekStart = duesTickIncrement;
  generateDues();
}

/*  - - - - - - - - - - - - - - - - objects - - - - - - - - - - - - - - - - -  */

function offerObj() { //constructor for the weekly randomized offers
  this.accepted = false;
  this.rejected = false;
  this.pays = [0, 0, 0, 0, 0, 0];
  this.income = 1;
  this.costs = [0, 0, 0, 0, 0, 0];
  //random amount
  let costCount = randomInt(3) + 1;
  for (let i = 0; i < costCount; i++) { //create random cost
    this.costs[randomInt(resources.length)]++;
  }
  let payCount = randomInt(costCount);
  for (let i = 0; i < payCount; i++) { //create random payout
    this.pays[randomInt(resources.length)]++;
  }
  let incomeCalc = (((gameInfo.maxValue - gameInfo.minValue) / 2) + gameInfo.minValue) / (randomInt(6) + 24); //24 - 29 days to equal current average value
  this.income = Math.floor(incomeCalc * ((costCount + 1) - payCount)); //multiply that by cost - pay difference
}

function resourceObj(color, icon) { //constructor esource object
  this.color = color;
  this.icon = icon;
  this.coloredIcon = `<span style="color:${this.color}">${this.icon}</span>`;
  this.outlinedIcon = `<span style="color:#000; text-shadow: -1px 0 ${this.color}, 0 1px ${this.color}, 1px 0 ${this.color}, 0 -1px ${this.color};">${this.icon}</span>`;
  this.highlightedColoredIcon = `<span class="highlighted" style="color:${this.color}">${this.icon}</span>`;
  this.percent = Math.floor(Math.random() * 60) + 20; //default startng percent 20%-80% | Percentage of constantly increasing gameInfo.min-max values
  this.value = 0; //recalculated daily after percentage change
  this.owned = 1; //how many the player owns
  this.modifyPercent = (m) => { //store the changed percent and recalulate the value (daily)
    this.percent = clamp(this.percent + m);
    let diff = gameInfo.maxValue - gameInfo.minValue; //calculates the value based on percentage between min and max values
    let p = diff * this.percent / 100;
    p = Math.round(p);
    this.value = p + gameInfo.minValue;
  }
  this.snapshots = [{
    'value': 35,
    'diff': 0
  }]; //snapshots saved for focus graph //35 initial value (36 is minimum starting value)
  this.takeSnapshot = () => { //store daily data for the focus graph
    this.snapshots.push({
      'value': this.value,
      'diff': 0
    });
    if (this.snapshots.length > gameInfo.snapshots) this.snapshots.shift();
  }
  this.buy = () => { //process buy request
    if (this.value <= gameInfo.currency) {
      gameInfo.currency -= this.value;
      this.owned++;
      this.snapshots[this.snapshots.length - 1].diff++;
    }
  }
  this.sell = () => { //process sell request
    if (this.owned > 0) {
      gameInfo.currency += this.value;
      this.owned--;
      this.snapshots[this.snapshots.length - 1].diff--;
    }
  }
  this.getFocusClamps = () => { //varrying min-max values for rendering focus graph
    let retVal = {
      'max': 3,
      'min': 1
    }; //low starting values, use lowest + highest values from saved snapshots
    if (this.snapshots.length < 1) return retVal;
    retVal.max = this.snapshots[0].value;
    retVal.min = this.snapshots[0].value;
    for (let i = 1; i < this.snapshots.length; i++) {
      if (this.snapshots[i].value < retVal.min) retVal.min = this.snapshots[i].value;
      if (this.snapshots[i].value > retVal.max) retVal.max = this.snapshots[i].value;
    }
    return retVal;
  }
  this.modifyPercent(0);
}

function duesObj() { //dues object constructor
  this.resources = []; //
  this.resetResources = () => {
    this.paid = false;
    this.resources = [];
    for (let i = 0; i < resources.length; i++) this.resources[i] = 0;
  }
  this.resetResources();
  this.addRandomResource = () => this.resources[Math.floor(Math.random() * this.resources.length)]++; //called per week based on calculated difficulty
  this.paid = true;
}

/*  - - - - - - - - - - - - - - - - game loop  - - - - - - - - - - - - - - - - -  */

function loop(timeStamp) { //main loop function
  var delta = timeStamp - lastRender
  if (gameInfo.play == true) {
    gameLogic(timeStamp);
    drawUI(timeStamp);
  }
  lastRender = timeStamp;
  window.requestAnimationFrame(loop); //loop
}

function gameLogic(timeStamp) {
  if (timeStamp > nextWorldTick) { //daily process
    gameInfo.maxValue += 2; //gold value increase per day
    gameInfo.minValue += 1;
    gameInfo.currency += gameInfo.income; //generate income per day
    for (let i = 0; i < resources.length; i++) {
      resources[i].modifyPercent(Math.floor(Math.random() * 11) - 5); // +- 5% / per resource then recalculate the value based on the % within the new min-max values
      resources[i].takeSnapshot(); //save 'yesterday's snapshot & start recording todays
    }
    if (gameInfo.dayOfWeek >= daysInWeek) { //weekly process
      if (gameInfo.dues.paid != true && gameInfo.allowGameOver == true) { //game over if dues werent paid
        gameOver();
      } else {
        settleOffers(); //add income + get resources from accepted offer, delete and regenerate accepted + rejected offers
        $('#dues').removeClass('paid'); //UI stuff
        generateDues(); //calculate dues for this week
        nextWeekStart = timeStamp + duesTickIncrement; //store next week start for UI timer + slider
      }
      gameInfo.dayOfWeek = 1;
    } else gameInfo.dayOfWeek++;
    fullDrawThisFrame = true; //next draw call will process all changes (more resource intensive)
    gameInfo.day++;
    nextWorldTick = timeStamp + worldTickIncrement; //store tomorrows time
    drawGraphs(timeStamp);  //draw daily changes
  }
}

function gameOver() { //stop gameplay, fill in score info and activate gameOver UI
  gameInfo.play = false;
  let netWorth = gameInfo.currency;
  let duesScore = Math.floor(gameInfo.duesScore);
  for (let i = 0; i < resources.length; i++) netWorth += resources[i].value * resources[i].owned;
  $('#nwScore').html(currencySymbol + numberWithCommas(netWorth));
  $('#duesScore').html(numberWithCommas(duesScore));
  $('#totalScore').html(numberWithCommas(duesScore + netWorth));
  $('#gameOver-full').removeClass('hide');
}

function generateDues() { //generate weekly dues
  gameInfo.duesTicks++;
  gameInfo.dues.resetResources();
  let difficulty = calculateDifficultyForWeek(gameInfo.duesTicks);
  for (let i = 0; i < difficulty; i++) {
    gameInfo.dues.addRandomResource();
  }
}

function calculateDifficultyForWeek(week) { //add dues quantity based on the week
  let difficulty = Math.floor(week / 4) + 1;
  difficulty += Math.floor(week / 15);
  difficulty += Math.floor(week / 22);
  return difficulty;
}

function settleOffers() { //settle offer at the end of the week
  for (let i = 0; i < gameInfo.offers.length; i++) {
    if (gameInfo.offers[i].accepted == true) {
      gameInfo.income += gameInfo.offers[i].income; // accepted offer income
      for (let x = 0; x < resources.length; x++) {
        resources[x].owned += gameInfo.offers[i].pays[x]; //accepted offer resources
      }
      gameInfo.offers[i] = new offerObj(); //generate new offer to replace accepted
    } else if (gameInfo.offers[i].rejected == true) {
      gameInfo.offers[i] = new offerObj(); //generate new offer to replace rejected
    }
  }
  changeOfferState(0);
}


/*  - - - - - - - - - - - - - - - - rendering + visual changes  - - - - - - - - - - - - - - - - -  */

function drawUI(timeStamp) { //refresh ui every frame
  let durLeft = nextWorldTick - timeStamp;
  let durPercent = durLeft / worldTickIncrement;
  $('#timerSlider').css('width', `${durPercent * 100}%`); //resize  daily slider

  let duesDurLeft = nextWeekStart - timeStamp;
  let duesDurPercent = duesDurLeft / duesTickIncrement;
  duesDurLeft = Math.round(duesDurLeft / 1000);
  if(duesDurLeft < 0) duesDurLeft = 0;
  $('#duesTimerNumber').html(duesDurLeft); //update weekly seconds counter
  $('#duesTimerSlider').css('width', `${duesDurPercent * 100}%`); //resize  weekly slider
  $('#day').html(`Day: ${gameInfo.day}`);
  if (fullDrawThisFrame) extendedDraw(); //extended draw when a change has been made
}

function extendedDraw(timeStamp) { //more resource intensive draws that should only process when something changes
  $('#currency').html(`Currency: ${currencySymbol}${gameInfo.currency}`);

  $('#income').html(`${currencySymbol}${gameInfo.income} <small>/ day</small>`);

  for (let i = 0; i < resources.length; i++) { //draw resource values
    $(`#r${i}Value`).html(`${currencySymbol}${resources[i].value}`);
    $(`#r${i}Owned`).html(`${resources[i].owned}`);

    if (resources[i].value <= gameInfo.currency) $(`#r${i}Buy`).removeClass('disabledButton'); //display interactable button only if resources are available
    else $(`#r${i}Buy`).addClass('disabledButton');

    if (resources[i].owned > 0) $(`#r${i}Sell`).removeClass('disabledButton');
    else $(`#r${i}Sell`).addClass('disabledButton');
  }

  let duesList = $('#duesList'); //generate dues html based on what is owed
  duesList.html('');
  let enableButton = true; //any unpayable resource will toggle this false
  if (gameInfo.dues.paid != true) {
    for (let i = 0; i < gameInfo.dues.resources.length; i++) {
      for (let z = 0; z < gameInfo.dues.resources[i]; z++) {
        if (resources[i].owned > z) duesList.html(duesList.html() + resources[i].highlightedColoredIcon); //set to highlighted if player has the resources
        else {
          duesList.html(duesList.html() + resources[i].outlinedIcon); //set to outlined if player doesnt have the resources
          enableButton = false;
        }
      }
    }
  } else enableButton = false;

  if (enableButton == true) $('#payDues').removeClass('disabledButton'); //process interactable button based on calculation
  else $('#payDues').addClass('disabledButton');
  drawOffers(true); //draw offers sub-extended draw (called seperately sometimes)
  drawGraphs(timeStamp);
  fullDrawThisFrame = false;
}

function drawGraphs(timeStamp) { //draw main bar graph
  graphContext.clearRect(0, 0, graphInfo.width, graphInfo.height);

  graphContext.lineWidth = 2;
  graphContext.strokeStyle = '#333';
  for (let i = 1; i < 10; i++) { //graph lines
    let pY = (graphInfo.height / 10) * i;
    graphContext.beginPath()
    graphContext.moveTo(0, pY);
    graphContext.lineTo(graphInfo.width, pY);
    graphContext.stroke();
  }
  for (let i = 0; i < resources.length; i++) { //draw resource values
    let drawHeight = ((resources[i].value - gameInfo.minValue) / (gameInfo.maxValue - gameInfo.minValue)) * graphInfo.height; //value percentage * full height
    graphContext.fillStyle = resources[i].color;
    graphContext.fillRect(i * (graphInfo.rWidth + graphInfo.rSpacing) + graphInfo.rSpacing, graphInfo.height - drawHeight, graphInfo.rWidth, drawHeight);
  }

  drawFocusGraph(); //
}

function drawFocusGraph() { //draw focus graph using snapshots of the currently focused resource
  focusGraphContext.translate(0, 0);
  focusGraphContext.clearRect(0, 0, focusGraphInfo.width, focusGraphInfo.height);

  if (resources[focusIndex].snapshots.length > 0) { //iterate snapshots for currently focused resource and draw lines and label where sold/bought resources occured
    let focusClamps = resources[focusIndex].getFocusClamps();
    focusGraphContext.lineWidth = 1;
    focusGraphContext.strokeStyle = resources[focusIndex].color;
    focusGraphContext.beginPath();
    let spacing = focusGraphInfo.sX / (resources[focusIndex].snapshots.length - 1);
    for (let i = 0; i < resources[focusIndex].snapshots.length; i++) {

      xPos = focusGraphInfo.pX + spacing * i;
      let perc = (resources[focusIndex].snapshots[i].value - focusClamps.min) / (focusClamps.max - focusClamps.min);
      let yPos = focusGraphInfo.pY + focusGraphInfo.sY - (focusGraphInfo.sY * perc);

      if (i > 0) focusGraphContext.lineTo(xPos, yPos);
      else focusGraphContext.moveTo(xPos, yPos);
      focusGraphContext.stroke();

      if (resources[focusIndex].snapshots[i].diff != 0) { //label if resources were sold or bought this day
        if (resources[focusIndex].snapshots[i].diff > 0) focusGraphContext.fillStyle = resources[focusIndex].color;
        else focusGraphContext.fillStyle = 'yellow';
        let val = Math.abs(resources[focusIndex].snapshots[i].diff);
        focusGraphContext.font = 'bold 18px monospace';
        focusGraphContext.fillText(val, xPos - 4, yPos + (perc < .5 ? -10 : 16));
      }
    }

  }

}

function drawOffers(drawPay) { //draw offers , drawPay = true if it is an extended draw. false if it is called by a offer state change
  for (let i = 0; i < gameInfo.offers.length; i++) {
    let cost = ''; //cost / pay generated html
    let pay = '';
    let canPay = true;
    for (let x = 0; x < resources.length; x++) {
      for (let z = 0; z < gameInfo.offers[i].costs[x]; z++) {
        if (gameInfo.offersState < 1) {
          if (resources[x].owned > z) cost += resources[x].highlightedColoredIcon; //highlighted icon if cost resources are owned
          else {
            cost += resources[x].outlinedIcon; //outlined icon if cost resources arent owned
            canPay = false;
          }
        } else {
          cost += resources[x].coloredIcon; //colored if accepted offer has already been chosen
        }
      }
      if (drawPay == true) {
        for (let z = 0; z < gameInfo.offers[i].pays[x]; z++) {
          pay += resources[x].coloredIcon; //colord icon if payout
        }
      }
    }
    $(`#offer${i}content > .costsContainer > .offerCosts`).html(cost); //add generated code
    if (canPay == false) $(`#offer${i}Button`).addClass('disabledButton'); //toggle button as payable/not
    else $(`#offer${i}Button`).removeClass('disabledButton');
    if (drawPay == true) {
      $(`#offer${i}content > .paysContainer > .offerIncome`).html(`${currencySymbol}${gameInfo.offers[i].income}<small> / day</small>`);
      $(`#offer${i}content > .paysContainer > .offerPays`).html(pay);
    }
  }
}


/*  - - - - - - - - - - - - - - - - interaction / button responses  - - - - - - - - - - - - - - - - -  */

function payDues() { //pay dues button pressed
  for (let i = 0; i < gameInfo.dues.resources.length; i++) { //check to make sure all can be paid
    if (gameInfo.dues.resources[i] > resources[i].owned) return false;
  }
  let duesScore = 0;
  for (let i = 0; i < gameInfo.dues.resources.length; i++) { //pay all
    resources[i].owned -= gameInfo.dues.resources[i];
    duesScore += resources[i].value * gameInfo.dues.resources[i];
  }
  gameInfo.duesScore += duesScore * 1.25; //record dues score
  $('#dues').addClass('paid'); //set ui to reflect paid
  gameInfo.dues.paid = true;
  fullDrawThisFrame = true;
}

function offerButtonPressed(index) {
  if (gameInfo.offersState == 0) {
    let result = [];
    let success = true;
    for (let i = 0; i < resources.length; i++) { //make sure player can pay resource costs
      if (resources[i].owned < gameInfo.offers[index].costs[i]) success = false;
    }
    if (success) {
      for (let i = 0; i < resources.length; i++) {
        resources[i].owned -= gameInfo.offers[index].costs[i]; //pay offer
      }
      gameInfo.offers[index].accepted = true;
      changeOfferState(1);
      fullDrawThisFrame = true;
    }
  } else if (gameInfo.offersState == 1) { //set rejected offer
    gameInfo.offers[index].rejected = true;
    changeOfferState(2);
    fullDrawThisFrame = true;
  }
}

function changeOfferState(index) {
  gameInfo.offersState = index;
  for (let i = 0; i < gameInfo.offers.length; i++) {
    let b = $(`#offer${i}Button`);
    let o = $(`#offer${i}`);
    if (gameInfo.offersState == 0) { //state 0  = player choosing an offer to accept
      o.removeClass('accepted'); //reset changes from previous weeks
      o.removeClass('rejected');
      o.removeClass('ignored');
      b.html('ACCEPT'); //
      b.addClass('acceptState');
    } else if (gameInfo.offersState == 1) { //state 1  = player choosing an offer to reject
      b.addClass('rejectState');
      b.removeClass('acceptState');
      if (gameInfo.offers[i].accepted == true) {
        o.addClass('accepted');
        b.html('<i class="far fa-check-circle"></i>');
      } else {
        b.html('REJECT');
      }
    } else { //state 2  = choices made for the week
      b.removeClass('rejectState');
      if (gameInfo.offers[i].rejected == true) {
        o.addClass('rejected');
        b.html('<i class="far fa-times-circle"></i>');
      } else if (gameInfo.offers[i].accepted != true) {
        o.addClass('ignored');
        b.html('<i class="fas fa-sync-alt"></i>')
      }
    }
  }
}

function buy(index) {
  fullDrawThisFrame = true;
  resources[index].buy();
  setFocus(index);
}

function sell(index) {
  fullDrawThisFrame = true;
  resources[index].sell();
  setFocus(index);
}

function setFocus(index) { //focus draw will start drawing this resource
  focusIndex = index;
  $('#focusGraphIcon').html(resources[index].icon);
  $('#focusGraph').css('border-color', resources[index].color);
  drawFocusGraph();
}

function graphClicked(e) { //clicking main graph focuses that resource
  let relativePos = e.clientX - $('#graph').offset().left;
  let colSize = graphInfo.width / resources.length;
  for (let i = 0; i < resources.length; i++) {
    if ((i + 1) * colSize > relativePos) {
      setFocus(i);
      return;
    }
  }
}

/*  - - - - - - - - - - - - - - - - utility functions  - - - - - - - - - - - - - - - - -  */

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


function randomInt(options) {
  return Math.floor(Math.random() * Math.floor(options)); //0 - options-1
}

function clamp(value) {
  if (value > 100) value = 100;
  else if (value < 0) value = 0;
  return value;
}

/*  - - - - - - - - - - - - - - - - just a way to toggle fullscreen  - - - - - - - - - - - - - - - - -  */

$(`#statusInfo`).click(() => toggleFullscreen());

function toggleFullscreen(event) {
  var element = document.body;
  if (event instanceof HTMLElement) {
    element = event;
  }
  var isFullscreen = document.webkitIsFullScreen || document.mozFullScreen || false;
  element.requestFullScreen = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || function() {
    return false;
  };
  document.cancelFullScreen = document.cancelFullScreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || function() {
    return false;
  };
  isFullscreen ? document.cancelFullScreen() : element.requestFullScreen();
}
