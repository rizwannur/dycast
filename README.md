# Douyin Cast

<p align=center>
  <a href="https://github.com/skmcj/dycast">
    <img src="https://gcore.jsdelivr.net/gh/skmcj/pic-bed/common/dydm-bg-logo.png" alt="Douyin Cast" style="width: 200px">
  </a>
</p>

<p align=center style="font-weight: bold;">
   Douyin Cast
</p>

## Introduction

A small project for fetching barrage comments from Douyin live streams.

Users only need to enter the room number of a live stream, and the program can fetch the barrage comments of the corresponding live stream in real-time, parse and display them. Users can also forward the fetched barrage information to their own backend for other purposes (such as interactive barrage games, data analysis, etc.) through a `ws/wss` address.

### Features

- Get live stream connection information
- Connect to the live stream and get barrage comments
  - Implement a reconnection mechanism to ensure connection stability to a certain extent
- Forward live stream barrage
  - Mainly for parsed and extracted barrage, in serialized `json` format
- Categorize and display live stream barrage
  - Chat barrage (including text, regular emojis, member emojis, combined emojis, etc.)
  - Gift barrage
  - Follow barrage
  - Like barrage (including the number of likes)
  - Entry barrage
  - Other information (such as some tips during the connection process)
- Display live stream information, such as the number of viewers, etc.

## Implementation Principle

There are two main difficulties to solve: calculating the `wss` link for Douyin barrage and parsing the received binary barrage data.

- Calculating the `wss` link for Douyin barrage

  - Enter a Douyin live stream, open the browser's network request panel, and you can see a `ws` link, which is the real-time barrage communication link for the Douyin live stream.
  - Observe its protocol address, which mainly contains a most important parameter `signature`, which needs to be calculated from `roomId` and `uniqueId`. By following breakpoints and performing some reverse engineering, you can know its approximate calculation principle.
  - This project encapsulates the corresponding calculation function in the `src/core/signature` file.
  - After calculating the `signature` parameter, combine it with the previous `roomId` and `uniqueId` to get the complete `wss` link.
  - Then establish a connection and receive data.

- Parsing barrage data

  - After successfully establishing a connection, you will find that the received data is a binary string.

  - After consulting online materials, it is known that it uses the `protobuf` protocol for transmission. To parse it, you need the corresponding `proto` file.

  - The corresponding `proto` file can be obtained by entering the live stream, performing some reverse engineering, imitating the object structure parsed behind it, and integrating the corresponding `proto` file.

  - You can try it yourself. If you have no idea, you can search for some keywords, such as `PushFrame`, `WebcastChatMessage`, etc.

  - After obtaining the `proto` file of the barrage data, use `protoc` or other tools to compile it into files in various languages.

  - This project mainly compiles it into a `ts` file, compiles it through `protobufjs`, and modifies the product to change `Long` to a string.

    - ```sh
      # Reference command
      pbjs --ts model.ts model.proto
      ```
    
  - The generated `[model.ts]` can be imported and used in the project.
  
- After having the parsing file, you can use it to parse the barrage data. Parse a frame of data obtained from `ws` into `PushFrame`. The `payload` in it is still a piece of binary data and has been compressed by `gzip`. After decompressing it, parse it into `Response`. The `messages` in it are the corresponding message data, the structure is `Message` type, and the `payload` in it is the specific barrage message body after parsing. The main parsing types are `ChatMessage`, `MemberMessage`, `LikeMessage`, etc.
  
- The above `PushFrame`, `...` are all `proto` structures of barrage data. You can learn more about them yourself.

## Data Structure

Packaging data to be sent to the backend

```typescript
/** The final organized and forwarded barrage message structure */
export interface DyMessage {
  // Barrage ID
  id?: string;
  // Barrage type
  method?: CastMethod;
  // User information
  user?: CastUser;
  // Gift information (has a value when the type is gift barrage)
  gift?: CastGift;
  // Barrage text
  content?: string;
  // Rich text information
  rtfContent?: CastRtfContent[];
  // Room related information
  room?: LiveRoom;
  // Gift ranking information
  rank?: LiveRankItem[];
}

/** Live stream information */
export interface LiveRoom {
  /**
   * Number of online viewers
   */
  audienceCount?: number | string;
  /**
   * Number of likes in this session
   */
  likeCount?: number | string;
  /**
   * Number of anchor's fans
   */
  followCount?: number | string;
  /**
   * Cumulative number of viewers
   */
  totalUserCount?: number | string;
  /** Room status */
  status?: number;
}
/**
 * Gift and like ranking
 */
export interface LiveRankItem {
  nickname: string;
  avatar: string;
  rank: number | string;
}

export interface CastUser {
  // user.sec_uid | user.id_str
  id?: string;
  // user.nickname
  name?: string;
  // user.avatar_thumb.url_list.0
  avatar?: string;
  // Gender (guess) 0 | 1 | 2 => Unknown | Male | Female
  gender?: number;
}

export interface CastGift {
  id?: string;
  name?: string;
  // Value in Douyin coins diamond_count
  price?: number;
  type?: number;
  // Description
  desc?: string;
  // Image
  icon?: string;
  // Quantity repeat_count | combo_count
  count?: number | string;
  // Gift messages may be sent repeatedly, 0 means the first time, not repeated
  repeatEnd?: number;
}

/**
 * Rich text type
 *  1 - Plain text
 *  2 - Combined emoji
 */
export enum CastRtfContentType {
  TEXT = 1,
  EMOJI = 2
}

// Rich text
export interface CastRtfContent {
  type?: CastRtfContentType;
  text?: string;
  url?: string;
}
// Barrage type
export enum CastMethod {
  CHAT = 'WebcastChatMessage',
  GIFT = 'WebcastGiftMessage',
  LIKE = 'WebcastLikeMessage',
  MEMBER = 'WebcastMemberMessage',
  SOCIAL = 'WebcastSocialMessage',
  ROOM_USER_SEQ = 'WebcastRoomUserSeqMessage',
  CONTROL = 'WebcastControlMessage',
  ROOM_RANK = 'WebcastRoomRankMessage',
  ROOM_STATS = 'WebcastRoomStatsMessage',
  EMOJI_CHAT = 'WebcastEmojiChatMessage',
  FANSCLUB = 'WebcastFansclubMessage',
  ROOM_DATA_SYNC = 'WebcastRoomDataSyncMessage',
  /** Custom message */
  CUSTOM = 'CustomMessage'
}
```

**Note:** In theory, the received raw barrage data contains all the data that Douyin barrage should have, but currently only the more important data above is extracted and packaged for the backend. If you need other data, you can research and package it yourself. The target file is `src/core/dycast.ts`.

## Project Preview

For a complete project demonstration, please go to [Bilibili](https://www.bilibili.com/video/BV1Vj411c7FF/)

- After the project is running, the specific interface is displayed as follows

  ![Main interface](https://static.ltgcm.top/md/20250428180514.png)

  - The overall interface is a three-column layout: the left side is for live stream information and connection status display; the middle is for the main barrage display; the right side is for input and other information display.
  - The right side mainly contains two input boxes. The first is the room number input box, and the second is the forwarding address input box. The input has format verification, and you cannot connect if the format is incorrect.
  - The row of icon buttons on the right side of the barrage display list indicates the type of barrage currently displayed in the list. You can click to control its visibility.

- After entering the room number in the room number input box on the right, click **Connect**. After waiting for a few seconds, the connection result will be displayed in the status information in the lower left corner. Sometimes network congestion may occur, you can connect later. Normally, there will be corresponding message notifications for successful/failed connections, and you can also check the console output. After a successful connection, the display is roughly as follows:

  ![Result](https://static.ltgcm.top/md/20250428181510.png)

- At this time, the user can fill in their own `WebSocket` server address in the forwarding information box, click **Forward**, and a connection can be established to transmit the barrage information to the set backend in real-time.

## Deployment Steps

- Project dependency installation

    ```sh
    npm install
    ```

- Project execution

    ```sh
    npm run dev
    ```

- Project packaging

    ```sh
    npm run build
    ```

- Deploying the project to `nginx`

  ```nginx
  # Configure network listening
  server {
      # Listening port number, e.g.: 1234
      listen       1234;
      # Listening address, can be a domain name or IP address, can be written with regular expressions
      server_name  localhost;
  
      location / {
          add_header Access-Control-Allow-Origin *;
          # Root directory, that is, the location of the project packaging content (.../dist), can be the local path of the project
          root   /var/dycast;
          # Configure the default home page file
          index  index.html index.htm;
          # Configure the single-page application refresh problem, return to the home page by default
          try_files $uri $uri/ /index.html;
      }
      
      # Configure interface cross-domain
      location /dylive {
          # proxy_pass The address of the interface you want to cross-domain
          proxy_pass https://live.douyin.com/;
  
          # Response header size
          proxy_buffer_size 64k;
          # Response body size = quantity * size
          proxy_buffers   32 64k;
          # The size of the buffer in the busy state, generally proxy_buffer_size * 2
          proxy_busy_buffers_size 128k;
  
          # Modify request header
          proxy_set_header Host live.douyin.com;
          proxy_set_header Referer 'https://live.douyin.com/';
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          # If you need to configure it to be available on mobile devices
          # You need to set the request header User-Agent to disguise the PC UA to prevent mobile redirection
          set $ua $http_user_agent;
          if ($http_user_agent ~* "(iphone|ipad|android|mobile)") {
              set $ua "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0";
          }
          proxy_set_header User-Agent $ua;
  
          # Process response Set-Cookie
          # Ensure that Set-Cookie can be set normally to the current domain
          # Clear Domain
          proxy_cookie_domain ~.* $host;
          # Unify Path
          proxy_cookie_path / /;
          
          # Clear SameSite / Secure
          # Not necessarily all need to be set, some browsers need it
          # Can be implemented with the help of the ngx_headers_more module
  
          # Ensure that Set-Cookie is forwarded to the client
          proxy_pass_header Set-Cookie;
          
  
          # Rewrite path - remove /dylive prefix
          rewrite ^/dylive/(.*) /$1 break;
      }
      
      location /socket {
          # Nginx does not distinguish between ws / wss protocols
          # WebSocket is actually implemented through HTTP upgrade
          # Therefore, use https:// instead of wss://
          proxy_pass https://webcast5-ws-web-lf.douyin.com/;
  
          # WebSocket key configuration
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
  
          # Cross-domain related headers
          proxy_set_header Origin https://live.douyin.com;
          proxy_set_header Host webcast5-ws-web-lf.douyin.com;
  
          # Optional: Keep the Cookie header for authentication
          proxy_set_header Cookie $http_cookie;
          
          set $ua $http_user_agent;
          if ($http_user_agent ~* "(iphone|ipad|android|mobile)") {
              set $ua "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0";
          }
          proxy_set_header User-Agent $ua;
  
          # Rewrite path - remove /socket
          rewrite ^/socket/(.*) /$1 break;
      }
  
  }
  ```
  

## Star History

![Star History Chart](https://api.star-history.com/svg?repos=skmcj/dycast&type=Date)

## Donation

<p align=center>
  <img src="https://static.ltgcm.top/md/20250428191027.png" alt="Donation" style="width: 350px">
</p>

<p align=center style="color: #68945c;">
   If you want to support the continuous maintenance of this project, you can feed the UP (｀･ω･´)ゞSalute
</p>



## Disclaimer

This project is for learning and communication purposes only. All illegal abuses are prohibited, otherwise you will be responsible for the consequences.
