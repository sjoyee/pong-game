/**
 * Name: Siang Jo Yee   
 * Student ID: 31159265
 * FIT2102 Assignment 1: Pong game
 * 
 * pong.ts: Implementing an one-player game using functional reactive programming techniques
 * 
 * 
 */
import { BehaviorSubject, fromEvent, interval} from 'rxjs'; 
import { map,filter,scan, merge, takeWhile} from 'rxjs/operators';

function pong() {
    // Inside this function you will use the classes and functions 
    // from rx.js
    // to add visuals to the svg element in pong.html, animate them, and make them interactive.
    // Study and complete the tasks in observable exampels first to get ideas.
    // Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/ 
    // You will be marked on your functional programming style
    // as well as the functionality that you implement.
    // Document your code!  

    const 
      canvas = document.getElementById("canvas"), //pong game will be carried out on this canvas
      button = document.getElementById("startButton") //clicking on this button is allowed in order to restart when game ends

      /**
       * Contains all the useful initial values for generating the pong game in a class where its properties are immutable 
       * and only reading are allowed. This helps preventing side effect and global mutation of state.
       */
    const Constants = new class {
        readonly CanvasHeight = canvas.getBoundingClientRect().height;
        readonly CanvasWidth = canvas.getBoundingClientRect().width;
        readonly CanvasLeft = canvas.getBoundingClientRect().left;
        readonly CanvasRight = canvas.getBoundingClientRect().right;
        readonly CanvasTop = canvas.getBoundingClientRect().top;
        readonly CanvasBottom = canvas.getBoundingClientRect().bottom;
        readonly PaddleHeight = 60;
        readonly PaddleWidth = 15;
        readonly BallRadius = 8; 
        readonly BallSpeed = 3;
        readonly MaxBounceAngle = Math.PI/6; //max angle where the ball bounce on different part of the paddle
        readonly MaxChangeInVelocity = 5; //max change in velocity when ball strikes different part of the paddle
        readonly DegreeOfPerfectAI = 0.85; //The degree of how perfect an AI could be (the higher the more perfect an AI is)
      }

      /**
       * A class with property y which represents the position of the mouse's y-coordinate to assist in moving the player's paddle
       * in state reducer.
       */
      class Move {constructor(public readonly y: number) {}}

      /**
       * A class which allows any features which needs x and y, both numbers, as its properties. 
       * This class allows returning a new copy of x and y by creating a new object of class Vec. 
       * This includes calculation for moving position with velocity and converting to a new position. 
       * A new copy of the set of x and y can always ensure there is no side effect of mutating the position or the velocity, 
       * thus making it pure.
       * 
       * Adapted from https://stackblitz.com/edit/asteroids05?file=index.ts 
       */
      class Vec {
        constructor(public readonly x: number = 0, public readonly y: number = 0) {}
        convert = (b:Vec) => new Vec(b.x, b.y) 
        movePos = (b: Vec, vel: number) => new Vec(this.x + (Constants.BallSpeed * b.x), this.y + (Constants.BallSpeed * b.y))
      }

      type Event = 'mousemove'
      type ViewType = 'circle' | 'rect'

      /**
       * Create an Observable with payload of 'MouseEvent'.
       * @param event Name of event to be observed
       * @param result Map the y-coordinate of the mouse to T
       */
      const mouseOverObservable = <T>(event: Event, result: ({y} : {y:number}) => T) =>
        fromEvent<MouseEvent>(canvas, event).pipe(
          filter(({y}) => y < Constants.CanvasHeight + Constants.CanvasTop - Constants.PaddleHeight),
          map(({clientY}) => ({y: clientY - Constants.CanvasTop})),
          map(result)
        )

      /**
       * Observable which observes the event of "mousemove" and map the position of mouse to a new Move class.
       */
      const mouseMove$ = mouseOverObservable("mousemove", ({y}) => new Move(y))

      /**
       * BehaviourSubject with boolean value which indicates whether the game is running.
       */
      const running$ = new BehaviorSubject(true)

      /**
       * Create an Observable which observe a "click" on button, which is a HTML element.
       */
      const restart$ = fromEvent<MouseEvent>(button, 'click')
      

      /**
       * An interface written as type alias with only readonly members which describe the state of this pong game.
       * To allow transformation of values, we need to return a new copy of the object which implement this interface.
       */
      type State = Readonly <{
        ball: Feature,
        paddle: Paddle,
        gameOver: boolean
      }>

      /**
       * An interface written as type alias with only readonly members which differentiate the paddle in State as left and right,
       * where each of them has their own features.
       * To allow transformation of values, we need to return a new copy of the object which implement this interface.
       */
      type Paddle = Readonly <{
        left: Feature,
        right: Feature
      }>

      /**
       * An interface written as type alias with only readonly members which are the features of each state of this pong game.
       * To allow transformation of values, we need to return a new copy of the object which implement this interface.
       */
      type Feature = Readonly <{
        id : string,
        viewType: ViewType,
        height: number,
        width: number,
        speed : number,
        position : Vec,
        velocity: Vec,
        radius: number,
        movement: number,
        score: number,
        win: boolean
      }>

      /**
      * Create the left paddle by defining each of its feature and inititalising left paddle's attributes.
      * Return a new copy of object on Feature for any transformation of value to prevent side-effects.
      */
      const createLeftPaddle = () => 
        <Feature> {
        id: "leftPaddle",
        viewType: "rect",
        height: Constants.PaddleHeight,
        width: Constants.PaddleWidth,
        position: new Vec(35, (Constants.CanvasHeight/2 - Constants.PaddleHeight/2)),
        velocity: new Vec(),
        score: 0,
        win: false
      }

      /**
      * Create the right paddle by defining each of its feature and inititalising right paddle's attributes.
      * Return a new copy of object on Feature for any transformation of value to prevent side-effects.
      */
      const createRightPaddle = () =>
        <Feature> {
        id: "rightPaddle",
        viewType: "rect",
        height: Constants.PaddleHeight,
        width: Constants.PaddleWidth,
        position: new Vec(Constants.CanvasWidth - 50, (Constants.CanvasHeight/2 - Constants.PaddleHeight/2)),
        velocity: new Vec(),
        score: 0,
        win: false
      }

      /**
       * Create the two paddles of a pong game by defining the correct features regarding the left and right paddle.
       * Return a new copy of object on Paddle for any transformation of value to prevent side-effects.
       */
      const createPaddle = () => 
        <Paddle> {
        left: createLeftPaddle(),
        right: createRightPaddle()
      }
      
      /**
       * Create a ball by defining each of its features in a pong game and initialising their attributes.
       * Return a new copy of object on Feature for any transformation of value to prevent side-effects.
       */
      const createBall = () =>
        <Feature> {
        id : "ball",
        viewType: "circle",
        speed: Constants.BallSpeed,
        position: new Vec(Constants.CanvasWidth/2, Constants.CanvasHeight/2),
        velocity: new Vec(1,1),
        radius: Constants.BallRadius
        }

      /**
       * Create a new object named initial State and stores the initial values for the pong game.
       */
      const initialState : State = {
        ball: createBall(),
        paddle: createPaddle(),
        gameOver: false
      }

      /**
       * Handle the occurrence of events in the pong game such as updating the score, handling the collison between
       * the ball and the paddle or the wall, computing the velocity for the ball and the AI paddle and the changes 
       * in bounce angle and velocity due to difference in the striked part of paddle by the ball.
       * This is part of transforming or reducing the state of game in a pure functional way.
       * @param s Current state of the pong game
       * @returns A new copy of updated state which handled the occurrence of events in the pong game
       */
      const handleGameEvents = (s: State) => {
      
        /**
         * Check whether the ball hits the left or right side of the wall respectively.
         * @returns A boolean value indicating whether the ball hits either side of the wall
         */
        const 
          hitLeftWall = () => 
            s.ball.position.x - s.ball.radius <= 0,

          hitRightWall = () =>
            s.ball.position.x + s.ball.radius >= Constants.CanvasWidth
        
        /**
         * Check whether the player or the opponent wins the game, in other words scoring 7 points, respectively.
         */
        const 
          leftWin = () => s.paddle.left.score >= 7,
          rightWin = () => s.paddle.right.score >= 7
        
        /**
         * Reset the position of the feature to a new position.
         * @param from The feature in which its position is to be converted from.
         * @param to The feature in which the position is to be converted to.
         */
        const resetPos = (from: Feature) => (to: Feature) =>
          from.position.convert(to.position)

        /**
         * Update the scoreboard if one hit the ball onto their opponent's wall.
         */
        const
          newLeftScore = () => 
            hitRightWall() ? s.paddle.left.score + 1 : s.paddle.left.score,

          newRightScore = () => 
            hitLeftWall() ? s.paddle.right.score + 1 : s.paddle.right.score

        /**
         * Check whether anyone score in the pong game.
         */
        const haveScored = () => hitLeftWall() || hitRightWall()

        /**
         * Check whether the ball hit the top or bottom wall which is bounceable in the pong game.
         */
        const hitBounceableWall = () =>
            (s.ball.position.y - s.ball.radius <= 0) || 
            (s.ball.position.y + s.ball.radius >= Constants.CanvasHeight)
        
        /**
         * Check whether the ball is near the left paddle (in terms of x-coordinate), in other words, 
         * the left edge of the ball is smaller or equals to the right edge of the left paddle, and the 
         * right edge of the ball is larger or equals to the left edge of the left paddle.
         * 
         */
        const nearLeftPaddle = () =>
            s.ball.position.x - s.ball.radius <= s.paddle.left.position.x + s.paddle.left.width &&
            s.ball.position.x + s.ball.radius >= s.paddle.left.position.x
          
        /**
         * Check whether the ball is near the right paddle (in terms of x-coordinate), in other words, 
         * the right edge of the ball is larger or equals to the left edge of the right paddle, and the 
         * left edge of the ball is smaller or equals to the right edge of the right paddle.
         * 
         */
        const nearRightPaddle = () =>
            s.ball.position.x + s.ball.radius >= s.paddle.right.position.x &&
            s.ball.position.x - s.ball.radius <= s.paddle.right.position.x + s.paddle.right.width

        /**
         * Check whether the the ball is within the position of the paddle (in terms of y-coordinate), 
         * in other words, the top of the ball is smaller than the bottom of the paddle, and the bottom of 
         * the ball should be greater than the top of the paddle.
         * @param paddle The paddle which the ball is checked to be within it or not
         */
        const withinPaddle = (paddle: Feature) =>
            (s.ball.position.y + s.ball.radius > paddle.position.y) &&
            (s.ball.position.y - s.ball.radius < paddle.position.y + paddle.height)

          // Both condition must passed for hitting the paddle
        const
          hitLeftPaddle = nearLeftPaddle() && withinPaddle(s.paddle.left), 
          hitRightPaddle = nearRightPaddle() && withinPaddle(s.paddle.right)
          
        /**
         * Compute the centre position of the paddle.
         * @param paddle The paddle whicj we want to compute its centre position
         */
        const paddleCentrePos = (paddle: Feature) => 
          paddle.position.y + paddle.height/2
        
        /**
         * Compute the relative intersection of the ball and the paddle in terms of y-coordinates to
         * identify how far is the position where the ball strikes from the centre of the paddle.
         * 
         * @param paddle The paddle which we want to compute its relative Y-intersection with the ball
         */
        const relativeIntersectionAtPaddle = (paddle: Feature) =>
          s.ball.position.y === paddleCentrePos(paddle) ? 
          0 :
          s.ball.position.y < paddleCentrePos(paddle) ?
          paddleCentrePos(paddle) - (s.ball.position.y + s.ball.radius) : // if strikes at below part of the paddle
          paddleCentrePos(paddle) - (s.ball.position.y - s.ball.radius) // if strikes at upper part of the paddle

        /**
         * Compute the normalised relative intersection of the ball and the paddle in terms of y-coordinates.
         * This result computed from this function is needed to get the difference in the condition when the ball strikes 
         * at different part of the paddle. Returned result will be from -1 to 0.
         * @param paddle The paddle which we want to compute its normalised relative intersection of the ball with it
         */
        const normalisedRelativeIntersection = (paddle: Feature) => 
            relativeIntersectionAtPaddle(paddle) / (paddle.height/2)

        /**
         * A generalised function where to get the difference in condition when the ball strikes at different part of
         * a paddle.
         * @param maxVal The maximum value of the specific attribute
         * @param paddle The paddle which we want to compute the differences based on the part the ball strikes.
         */
        const strikeAtDiffPart = (maxVal: number) => (paddle: Feature) =>
          normalisedRelativeIntersection(paddle) * maxVal

        /**
         * Compute the bounce angle of the ball when it hits the paddle.
         */
        const bounceAngle = strikeAtDiffPart(Constants.MaxBounceAngle)

        /**
         * Compute the change in velocity of ball when it hits the paddle.
         */
        const processedChangeInVel = strikeAtDiffPart(Constants.MaxChangeInVelocity)

        const
          leftPaddleAngle = bounceAngle(s.paddle.left), //bounce angle for left paddle
          rightPaddleAngle = bounceAngle(s.paddle.right) //bounce angle for right paddle

        /**
         * Compute x-velocity with directions and bounce angle included.
         */
        const velXWithDirections = (angle: number) => (direction: number) =>
            s.ball.speed * Math.cos(angle) * direction
        
        /**
         * Compute y-velocity with directions and bounce angle included.
         */
        const velYWithDirections = (angle: number) => (direction: number) =>
            s.ball.speed * -Math.sin(angle) * direction
        
        /**
         * Compute x-velocity of the ball depending on which paddle does the ball hits, else it will 
         * remain unchanged.
         */
        const ballVelX = () =>
            hitLeftPaddle ? velXWithDirections(leftPaddleAngle)(1) : 
            hitRightPaddle ? velXWithDirections(rightPaddleAngle)(-1):
            s.ball.velocity.x
        
        /**
         * Compute y-velocity of the ball depending on which paddle does the ball hits, else it will 
         * remain unchanged. The y-velocity undergoes changes depending on how far from the centre of the paddle the
         * ball hits.
         */
        const ballVelY = () =>
            hitLeftPaddle ? velYWithDirections(leftPaddleAngle)(1) * Math.abs(processedChangeInVel(s.paddle.left)):
            hitRightPaddle ? velYWithDirections(rightPaddleAngle)(1) * Math.abs(processedChangeInVel(s.paddle.right)):
            s.ball.velocity.y
        
        /**
         * Compute the y-velocity of the ball if it hits the top or bottom wall by multiplying -1 so that the ball will
         * then move in opposite direction, in other words, bounce from the wall.
         */
        const updatedBallVelY = () => hitBounceableWall() ? (ballVelY() * -1) : ballVelY()
          
        // In the returned State below, any return of a new Vec object is to prevent side-effects and mutation of state in the game. 
        return <State> {
          ...s,
          ball: {...s.ball,
            // if anyone score in the game, the ball's position is set back to the initial position for the next round
            position: haveScored() ? resetPos(s.ball)(initialState.ball) : new Vec(s.ball.position.x, s.ball.position.y),
            velocity: new Vec(ballVelX(), updatedBallVelY())
          },
          paddle: {...s.paddle,
            left: {...s.paddle.left,
              position: 
              // if anyone score in the game, the AI paddle's position is set back to the initial position for the next round
                haveScored() ? 
                  resetPos(s.paddle.left)(initialState.paddle.left) : 
                  new Vec(initialState.paddle.left.position.x, s.paddle.left.position.y),
              // y-velocity of the ball is always following the ball's y-velocity, but slightly slower
              velocity: new Vec(initialState.paddle.left.velocity.x, updatedBallVelY() * Constants.DegreeOfPerfectAI),
              score: newLeftScore(),
              win: leftWin()
            },
            right: {...s.paddle.right,
              position: new Vec(initialState.paddle.right.position.x, s.paddle.right.position.y),
              score: newRightScore(),
              win: rightWin()
            }
          },
          // if anyone one scores 7 points 
          gameOver: leftWin() || rightWin()
        }
      }

      /**
       * Move the position of element with the velocity included.
       * A generalised function for code reusability.
       * @param f Any element which has features in the game and allowed to move.
       */
      const moveElem = (f: Feature) => <Feature>{
        ...f,
        position: f.position.movePos(f.velocity, Constants.BallSpeed)
      }

      /**
       * Update the game status by moving the element which features are updated in handleGameEvents(). 
       * In this case, we move the ball and the AI paddle.
       * This is part of transforming or reducing the state in a pure functional way.
       * @param s Current state of the pong game
       */
      const updateGameStatus = (s: State) =>
        handleGameEvents({
          ...s,
          ball: moveElem(s.ball),
          paddle: {...s.paddle,
            left: moveElem(s.paddle.left),
          }
        })

      /**
       * Update the game status with the fired observable.
       * @param s Current state of the pong game.
       * @param e The class which the observable stream are mapped.
       */
      const reduceState = (s:State, e: Move) =>
      e instanceof Move ? {...s,
        paddle: {
          ...s.paddle,
          right: {
            ...s.paddle.right,
            
            position: new Vec(initialState.paddle.right.position.x, e.y) 
            // y-coordinate of the right paddle should be the same as the y-coordinate of the mouse,
            // so it moves following the mouse cursor going up and down over the canvas
          }
        }
      } :
      // when the observable is not fired, the game still continues running with the state updated
      updateGameStatus(s);
      
      /**
       * Update the view of the pong game. Side-effects are contained in this function.
       * @param s Current state of the pong game
       */
      function updateView(s: State) {
        /**
         * A generic function for setting attribute of an HTML element.
         * Code adapted from: https://stackblitz.com/edit/asteroids05?file=index.ts
         * @param e An HTML element which has the attribute to be set
         * @param o An object with members which are the attributes to be set to
         */
        const attr = <T>(e:Element,o:T) => { for(const k in o) e.setAttribute(k,String(o[k])) }
        
        /**
         * Get the HTML element of ball, left paddle and right paddle if created, else create a new one through
         * the generalised function newElem().
         */
        const 
          ball = document.getElementById("ball") || newElem(s.ball.viewType, s.ball.id),
          leftPaddle = document.getElementById("leftPaddle") || newElem(s.paddle.left.viewType, s.paddle.left.id),
          rightPaddle = document.getElementById("rightPaddle")|| newElem(s.paddle.right.viewType, s.paddle.right.id)
          

        /**
         * Get the HTML element of score for the AI and player in the pong game.
         */
        const 
          leftScore = document.getElementById("leftScore"),
          rightScore = document.getElementById("rightScore"),
          endGameMsg = document.getElementById("endMessage")

        /**
         * A generalised function which create a new HTML element and added to the canvas's class list and 
         * appended as a new child.
         * @param type The qualified name of the shape of the element.
         * @param id The id of the HTML element.
         * @returns The HTML element created.
         */
        function newElem(type: string, id: string){
          const e = document.createElementNS(canvas.namespaceURI, type)
          canvas.classList.add(id)
          canvas.appendChild(e)
          return e
        }

        // Set the attribute for ball
        attr(ball, {id: s.ball.id,cx: s.ball.position.x, cy: s.ball.position.y, r: initialState.ball.radius, fill:"#FFFFFF"})
        
        // Set the attribute for left paddle
        attr(leftPaddle, {id: s.paddle.left.id, x: initialState.paddle.left.position.x, y: s.paddle.left.position.y, 
          width: initialState.paddle.left.width, height: initialState.paddle.left.height, fill:"#FFFFFF"})

        // Set the attribute for right paddle
        attr(rightPaddle, {id: s.paddle.right.id, x: initialState.paddle.right.position.x, y: s.paddle.right.position.y, 
          width: initialState.paddle.right.width, height: initialState.paddle.right.height, fill:"#FFFFFF"})
          
        // Update the text content with the updated scores
        rightScore.textContent = String(s.paddle.right.score)
        leftScore.textContent = String(s.paddle.left.score)
        
        // Update the text content of the end game message by indicating the winner
        s.paddle.right.win ? endGameMsg.textContent = "PLAYER WINS!" : 
        s.paddle.left.win? endGameMsg.textContent = "OPPONENT WINS!" :
        endGameMsg.textContent = ""
      

        if (s.gameOver) {
          running$.next(false)  //the last emitted value of running$ would be false 
          button.classList.remove('hidden') // to show the button for clicking to restart
        }
        else {
          button.classList.add('hidden') // to hide the button from view
        }
      }

      /**
       * Get the value of the BehaviourSubject, running$.
       */
      function isRunning(){
        return running$.getValue()
      }

      /**
       * Subscription which determine the lifetime of the state in pong game.
       * 
       * Scan is very much like the reduce function on Array in that it applies an accumulator function to the elements 
       * coming through the Observable, except instead of just outputting a single value (as reduce does), it emits a 
       * stream of the running accumulation (in this case, the sum so far). Thus, we use the last function to finally 
       * produce an Observable with the final value.
       * 
       */
      function startGame (){
        interval(30).pipe(
          merge(mouseMove$), 
          scan(reduceState, initialState),
          takeWhile(isRunning)).subscribe(updateView)
      }

      /**
       * Subscription to start/restart the game.
       */
      restart$.subscribe(restartGame)

      /**
       * Restart the game by removing unwanted end game message and resetting the BehaviourSubject which 
       * emits true when the game is running. Call startGame() for a new game.
       */
      function restartGame(){
        running$.next(true)
        startGame()
      }
  }
  
  // the following simply runs your pong function on window load.  Make sure to leave it in place.
  if (typeof window != 'undefined')
    window.onload = ()=>{
      pong();
    }
