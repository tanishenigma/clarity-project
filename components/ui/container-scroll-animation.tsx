"use client";
import React, { useRef } from "react";
import { useScroll, useTransform, motion, MotionValue } from "motion/react";

export const ContainerScroll = ({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode;
  children: React.ReactNode;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
  });
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // On mobile: no rotation (looks broken), no scale, no translate
  const rotateRange = isMobile ? [0, 0] : [20, 0];
  const scaleRange = isMobile ? [1, 1] : [1.05, 1];
  const translateRange = isMobile ? [0, 0] : [0, -100];

  const rotate = useTransform(scrollYProgress, [0, 1], rotateRange);
  const scale = useTransform(scrollYProgress, [0, 1], scaleRange);
  const translate = useTransform(scrollYProgress, [0, 1], translateRange);

  return (
    <div
      className="h-auto md:h-[80rem] flex items-center justify-center relative p-4 md:p-20"
      ref={containerRef}>
      <div
        className="py-6 md:py-40 w-full relative"
        style={{ perspective: isMobile ? "none" : "1000px" }}>
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  );
};

export const Header = ({ translate, titleComponent }: any) => {
  return (
    <motion.div
      style={{ translateY: translate }}
      className="max-w-5xl mx-auto text-center">
      {titleComponent}
    </motion.div>
  );
};

export const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  translate: MotionValue<number>;
  children: React.ReactNode;
}) => {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        transformOrigin: "top center",
        // boxShadow:
        //   "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}>
      <div className="h-full w-full overflow-hidden rounded-3xl bg-background dark:bg-zinc-900   shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_30px_60px_-15px_rgba(0,0,0,0.5),0_0_100px_-20px_rgba(120,119,198,0.25)]">
        {children}
      </div>
    </motion.div>
  );
};
