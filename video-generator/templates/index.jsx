import React from 'react';
import { Composition } from 'remotion';
import { TutorialVideo } from './TutorialVideo';
import { PresentationVideo } from './PresentationVideo';
import { DemoVideo } from './DemoVideo';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="tutorial"
        component={TutorialVideo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'How to Use Vendy-Buildr',
          script: 'Welcome to Vendy-Buildr tutorial'
        }}
      />
      <Composition
        id="presentation"
        component={PresentationVideo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Why Choose Vendy-Buildr',
          script: 'Discover the power of Vendy-Buildr'
        }}
      />
      <Composition
        id="demo"
        component={DemoVideo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          title: 'Vendy-Buildr Product Demo',
          script: 'See Vendy-Buildr in action'
        }}
      />
    </>
  );
};
